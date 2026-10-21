import { useEffect, useRef, useState } from "react"
import { Capacitor, registerPlugin } from "@capacitor/core"
import { QRCodeSVG } from "qrcode.react"

type Screen = "home" | "keyboard" | "remote"
type ConnectionState = "idle" | "connecting" | "connected" | "unsupported"
type LineEnding = "CR+LF" | "LF" | "Ninguno"
type TerminalEntry = {
  id: number
  direction: "TX"
  message: string
  time: string
}
type BluetoothDeviceLike = {
  id?: string
  name?: string
  address?: string
  gatt?: { connect: () => Promise<unknown> }
}
type BluetoothLike = {
  getDevices?: () => Promise<BluetoothDeviceLike[]>
  requestDevice: (options: {
    acceptAllDevices: boolean
  }) => Promise<BluetoothDeviceLike>
}
type BluetoothClassicPlugin = {
  requestPermissions: () => Promise<void>
  listPairedDevices: () => Promise<{ devices: BluetoothDeviceLike[] }>
  connect: (options: { address: string }) => Promise<void>
  openSettings: () => Promise<void>
}

const BluetoothClassic =
  registerPlugin<BluetoothClassicPlugin>("BluetoothClassic")

const letters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("")
const frequencies = letters.map((_, index) => 220 * Math.pow(2, index / 12))
const backgroundPhotos: Record<Screen, { url: string credit: string }> = {
  home: {
    url: "https://images.unsplash.com/photo-1500993855538-c6a99f437aa7?auto=format&fit=crop&w=2000&q=85",
    credit: "Philippe Toupet",
  },
  keyboard: {
    url: "https://images.unsplash.com/photo-1517933981816-1f2d0c2ffc0d?auto=format&fit=crop&w=2000&q=85",
    credit: "Fabrizio Conti",
  },
  remote: {
    url: "https://images.unsplash.com/photo-1530173660394-4047e55984d1?auto=format&fit=crop&w=2000&q=85",
    credit: "Mukul Joshi",
  },
}

function BluetoothIcon({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
      <path
        d="m7 7 10 10-5 4V3l5 4L7 17"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function ArrowIcon() {
  return (
    <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M5 12h14m-5-5 5 5-5 5"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function PlayIcon() {
  return (
    <svg
      className="h-5 w-5"
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
    >
      <path d="M8 5.6c0-1.04 1.15-1.67 2.04-1.11l10 6.4a1.31 1.31 0 0 1 0 2.22l-10 6.4A1.31 1.31 0 0 1 8 18.4V5.6Z" />
    </svg>
  )
}

function RemoteIcon({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M8.5 8h7A5.5 5.5 0 0 1 21 13.5v2a3.5 3.5 0 0 1-6.16 2.28L13.3 16H10.7l-1.54 1.78A3.5 3.5 0 0 1 3 15.5v-2A5.5 5.5 0 0 1 8.5 8Z"
        stroke="currentColor"
        strokeWidth="1.8"
      />
      <path
        d="M8 11v5m-2.5-2.5h5M16.5 12.5h.01M18.5 15h.01"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <path
        d="m9 8 1-3h4l1 3"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function QrIcon() {
  return (
    <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M4 4h6v6H4V4Zm10 0h6v6h-6V4ZM4 14h6v6H4v-6Zm11 0h2v2h-2v-2Zm3 0h2v3h-2v-3Zm-4 4h3v2h-3v-2Zm5 1h1v1h-1v-1Z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
    </svg>
  )
}

export default function App() {
  const [screen, setScreen] = useState<Screen>("home")
  const [connection, setConnection] = useState<ConnectionState>("idle")
  const [deviceName, setDeviceName] = useState("")
  const [sequence, setSequence] = useState<string[]>([])
  const [lastSent, setLastSent] = useState("")
  const [lineEnding, setLineEnding] = useState<LineEnding>("CR+LF")
  const [terminalHistory, setTerminalHistory] = useState<TerminalEntry[]>([])
  const [activeLetter, setActiveLetter] = useState("")
  const [remoteCommand, setRemoteCommand] = useState("EN ESPERA")
  const [activeDirection, setActiveDirection] = useState("")
  const [speed, setSpeed] = useState(60)
  const [lightsOn, setLightsOn] = useState(false)
  const [devicePanelOpen, setDevicePanelOpen] = useState(false)
  const [knownDevices, setKnownDevices] = useState<BluetoothDeviceLike[]>([])
  const [downloadPanelOpen, setDownloadPanelOpen] = useState(false)
  const audioContext = useRef<AudioContext | null>(null)
  const timeout = useRef<number | null>(null)
  const apkDownloadUrl = import.meta.env
    .VITE_ANDROID_APK_URL as string | undefined

  const speak = (message: string) => {
    if (!("speechSynthesis" in window)) return

    window.speechSynthesis.cancel()
    const announcement = new SpeechSynthesisUtterance(message)
    announcement.lang = "es-MX"
    announcement.rate = 0.95
    announcement.pitch = 1
    window.speechSynthesis.speak(announcement)
  }

  useEffect(() => {
    return () => {
      if (timeout.current) window.clearTimeout(timeout.current)
      void audioContext.current?.close()
    }
  }, [])

  useEffect(() => {
    const announcements: Record<Screen, string> = {
      home: "Bienvenido, maestro. Estás en Tono Uno. Conecta tu dispositivo o elige el teclado sonoro o el mando remoto.",
      keyboard:
        "Terminal Bluetooth abierta. Escribe un comando o toca una tecla rápida para enviarlo a tu Arduino.",
      remote:
        "Mando remoto abierto. Usa los controles para dirigir tu auto Arduino.",
    }

    speak(announcements[screen])
  }, [screen])

  const playTone = (letter: string) => {
    const index = letters.indexOf(letter)
    const AudioContextClass = window.AudioContext
    if (!AudioContextClass) return

    if (!audioContext.current) audioContext.current = new AudioContextClass()
    const context = audioContext.current
    const oscillator = context.createOscillator()
    const gain = context.createGain()

    oscillator.type = "sine"
    oscillator.frequency.value = frequencies[index]
    gain.gain.setValueAtTime(0.12, context.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.001, context.currentTime + 0.18)
    oscillator.connect(gain)
    gain.connect(context.destination)
    oscillator.start()
    oscillator.stop(context.currentTime + 0.18)

    setActiveLetter(letter)
    if (timeout.current) window.clearTimeout(timeout.current)
    timeout.current = window.setTimeout(() => setActiveLetter(""), 180)
  }

  const addCommand = (letter: string) => {
    playTone(letter)
    setSequence((current) => [...current, letter].slice(-12))
  }

  const connectToDevice = async (device: BluetoothDeviceLike) => {
    try {
      setConnection("connecting")
      speak(`Conectando con ${device.name || "el dispositivo seleccionado"}.`)
      if (Capacitor.getPlatform() === "android" && device.address) {
        await BluetoothClassic.connect({ address: device.address })
      } else if (device.gatt) {
        await device.gatt.connect()
      }
      setDeviceName(device.name || "Arduino Uno")
      setConnection("connected")
      setDevicePanelOpen(false)
      speak(`${device.name || "Arduino Uno"} conectado correctamente.`)
    } catch {
      setConnection("idle")
      speak(
        "No fue posible conectar el dispositivo. Puedes intentarlo de nuevo.",
      )
    }
  }

  const connectBluetooth = async () => {
    if (Capacitor.getPlatform() === "android") {
      setDevicePanelOpen(true)
      speak(
        "Panel de dispositivos abierto. Elige tu módulo HC cero cinco o HC cero seis.",
      )

      try {
        await BluetoothClassic.requestPermissions()
        const result = await BluetoothClassic.listPairedDevices()
        setKnownDevices(result.devices)
      } catch {
        setConnection("unsupported")
        speak(
          "Debes permitir el acceso a dispositivos cercanos para usar Bluetooth.",
        )
      }
      return
    }

    const bluetooth = (navigator as Navigator & { bluetooth?: BluetoothLike })
      .bluetooth
    if (!bluetooth) {
      setConnection("unsupported")
      speak("Este navegador no permite conectar dispositivos por Bluetooth.")
      return
    }

    setDevicePanelOpen(true)
    speak(
      "Panel de dispositivos abierto. Elige un dispositivo conocido o busca uno nuevo.",
    )

    if (bluetooth.getDevices) {
      try {
        setKnownDevices(await bluetooth.getDevices())
      } catch {
        setKnownDevices([])
      }
    }
  }

  const searchBluetoothDevices = async () => {
    if (Capacitor.getPlatform() === "android") {
      await BluetoothClassic.openSettings()
      speak(
        "Vincula tu módulo HC cero cinco o HC cero seis en los ajustes. Después vuelve a la aplicación y abre de nuevo la conexión.",
      )
      return
    }

    const bluetooth = (navigator as Navigator & { bluetooth?: BluetoothLike })
      .bluetooth
    if (!bluetooth) return

    try {
      setConnection("connecting")
      speak("Buscando dispositivos Bluetooth cercanos.")
      const device = await bluetooth.requestDevice({ acceptAllDevices: true })
      await connectToDevice(device)
    } catch {
      setConnection("idle")
      speak("La conexión fue cancelada. Puedes intentarlo de nuevo.")
    }
  }

  const sendSequence = () => {
    if (!sequence.length) return
    const command = sequence.join("")
    setLastSent(command)
    setTerminalHistory((current) =>
      [
        ...current,
        {
          id: Date.now(),
          direction: "TX",
          message: command,
          time: new Intl.DateTimeFormat("es-MX", {
            hour: "2-digit",
            minute: "2-digit",
            second: "2-digit",
            hour12: false,
          }).format(new Date()),
        },
      ].slice(-30),
    )
    sequence
      .filter((letter) => letters.includes(letter))
      .forEach((letter, index) => {
        window.setTimeout(() => playTone(letter), index * 150)
      })
    setSequence([])
  }

  const sendRemoteCommand = (command: string) => {
    setRemoteCommand(command)
    setActiveDirection(command)
    playTone(command === "BOCINA" ? "G" : "C")
    if (timeout.current) window.clearTimeout(timeout.current)
    timeout.current = window.setTimeout(() => setActiveDirection(""), 220)
  }

  return (
    <main className="relative isolate min-h-screen overflow-hidden bg-[#f4f1e9] text-[#102a43]">
      <div
        key={screen}
        className="pointer-events-none fixed inset-0 -z-20 bg-cover bg-center"
        style={{ backgroundImage: `url("${backgroundPhotos[screen].url}")` }}
        aria-hidden="true"
      />
      <div
        className="pointer-events-none fixed inset-0 -z-10 bg-[linear-gradient(110deg,rgba(244,241,233,0.97)_5%,rgba(244,241,233,0.88)_46%,rgba(244,241,233,0.58)_100%)]"
        aria-hidden="true"
      />
      <span className="pointer-events-none fixed bottom-3 right-4 z-10 rounded-full bg-[#102a43]/65 px-3 py-1 text-[9px] font-bold uppercase tracking-[0.12em] text-white/85 backdrop-blur-sm">
        Foto: {backgroundPhotos[screen].credit} · Unsplash
      </span>

      <header className="relative z-20 mx-auto flex max-w-[1180px] items-center justify-between px-5 py-6 sm:px-8 lg:px-10">
        <button
          className="group flex items-center gap-3"
          onClick={() => setScreen("home")}
          aria-label="Ir al inicio"
        >
          <span className="grid h-10 w-10 place-items-center rounded-xl bg-[#102a43] text-[#c7ff64] shadow-[0_5px_0_#77b6c8] transition-transform group-hover:-translate-y-0.5">
            <span className="flex h-5 items-end gap-[3px]">
              <i className="h-2 w-[3px] rounded-full bg-current" />
              <i className="h-5 w-[3px] rounded-full bg-current" />
              <i className="h-3 w-[3px] rounded-full bg-current" />
              <i className="h-4 w-[3px] rounded-full bg-current" />
            </span>
          </span>
          <span className="text-left">
            <span className="block text-[10px] font-bold uppercase tracking-[0.27em] text-[#537084]">
              Control sonoro
            </span>
            <span className="font-display text-xl font-extrabold tracking-tight">
              tono uno
            </span>
          </span>
        </button>

        <button
          onClick={connectBluetooth}
          disabled={connection === "connecting"}
          className={`flex items-center gap-2 rounded-full border px-4 py-2.5 text-sm font-bold transition-all ${
            connection === "connected"
              ? "border-[#b8e75f] bg-[#e9ffc0] text-[#24420d]"
              : "border-[#cbd5da] bg-white/60 hover:border-[#77b6c8] hover:bg-white"
          }`}
        >
          <span
            className={`h-2 w-2 rounded-full ${
              connection === "connected" ? "bg-[#5f9f1b]" : "bg-[#ef6a47]"
            }`}
          />
          {connection === "connecting"
            ? "Conectando..."
            : connection === "connected"
              ? deviceName
              : "Sin conectar"}
        </button>
      </header>

      {screen === "home" ? (
        <section className="relative mx-auto grid min-h-[calc(100vh-96px)] max-w-[1180px] items-center gap-12 px-5 pb-16 pt-7 sm:px-8 lg:grid-cols-[1.05fr_.95fr] lg:px-10 lg:py-10">
          <div className="relative z-10 max-w-[630px]">
            <div className="mb-7 inline-flex rotate-[-2deg] items-center gap-2 rounded-full bg-[#c7ff64] px-4 py-2 text-xs font-extrabold uppercase tracking-[0.14em] text-[#24420d] shadow-[3px_3px_0_#102a43]">
              <span className="h-2 w-2 animate-pulse rounded-full bg-[#ef6a47]" />
              Arduino + Bluetooth
            </div>
            <h1 className="font-display text-[clamp(3.6rem,8.7vw,7.4rem)] font-black leading-[0.83] tracking-[-0.065em] text-[#102a43]">
              Cada idea puede
              <span className="relative mt-3 block w-fit text-[#ef6a47]">
                convertirse en sonido.
                <svg
                  className="absolute -bottom-4 left-1 h-4 w-full text-[#77b6c8]"
                  viewBox="0 0 420 18"
                  preserveAspectRatio="none"
                  aria-hidden="true"
                >
                  <path
                    d="M3 12C99 1 274 3 417 8"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="7"
                    strokeLinecap="round"
                  />
                </svg>
              </span>
            </h1>
            <p className="mt-10 max-w-[530px] text-lg leading-relaxed text-[#4c6678] sm:text-xl">
              Conecta tu Arduino Uno y convierte el abecedario en comandos para
              tu bocina. Simple, visual y listo para experimentar.
            </p>
            <div className="mt-9 flex flex-wrap items-center gap-4">
              <button
                onClick={() => setScreen("keyboard")}
                className="flex items-center gap-3 rounded-2xl bg-[#102a43] px-7 py-4 font-extrabold text-white shadow-[0_7px_0_#77b6c8] transition-all hover:-translate-y-1 hover:shadow-[0_10px_0_#77b6c8] active:translate-y-1 active:shadow-[0_3px_0_#77b6c8]"
              >
                Abrir terminal <ArrowIcon />
              </button>
              <button
                onClick={() => setScreen("remote")}
                className="flex items-center gap-3 rounded-2xl border-2 border-[#102a43] bg-white/40 px-6 py-3.5 font-extrabold text-[#102a43] transition-all hover:-translate-y-1 hover:bg-white"
              >
                <RemoteIcon /> Mando remoto
              </button>
              <button
                onClick={connectBluetooth}
                className="flex items-center gap-2 px-3 py-4 font-bold text-[#2d5369] hover:text-[#102a43]"
              >
                <BluetoothIcon /> Conectar dispositivo
              </button>
              <button
                onClick={() => setDownloadPanelOpen(true)}
                className="flex items-center gap-2 rounded-2xl border border-[#cbd5da] bg-white/65 px-5 py-3.5 font-extrabold text-[#2d5369] backdrop-blur-sm transition-all hover:-translate-y-1 hover:border-[#77b6c8] hover:bg-white"
              >
                <QrIcon /> Descargar app
              </button>
            </div>
            {connection === "unsupported" && (
              <p className="mt-5 max-w-md rounded-xl border border-[#edb9aa] bg-[#fff0eb] px-4 py-3 text-sm text-[#8b3924]">
                Este navegador no admite Web Bluetooth. Prueba la versión más
                reciente de Chrome en Android o computadora.
              </p>
            )}
          </div>

          <div className="relative mx-auto h-[440px] w-full max-w-[500px] sm:h-[520px]">
            <div className="absolute left-1/2 top-1/2 h-[390px] w-[390px] -translate-x-1/2 -translate-y-1/2 rounded-full border-[3px] border-dashed border-[#77b6c8]/55 sm:h-[470px] sm:w-[470px]" />
            <div className="absolute left-[5%] top-[10%] rotate-[-8deg] rounded-2xl bg-white px-4 py-3 text-sm font-extrabold shadow-[0_8px_25px_#102a4320]">
              <span className="mr-2 inline-block text-[#ef6a47]">01</span>{" "}
              Conecta
            </div>
            <div className="absolute bottom-[7%] right-0 rotate-[7deg] rounded-2xl bg-[#c7ff64] px-4 py-3 text-sm font-extrabold shadow-[0_8px_25px_#102a4320]">
              <span className="mr-2 inline-block text-[#568e19]">02</span> Toca
              y escucha
            </div>
            <div className="absolute left-1/2 top-1/2 h-[310px] w-[310px] -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-full border-[10px] border-[#77b6c8] bg-[#102a43] shadow-[0_28px_0_#102a43] sm:h-[360px] sm:w-[360px]">
              <img
                src="https://images.unsplash.com/photo-1553406830-ef2513450d76?auto=format&fit=crop&w=900&q=90"
                alt="Placa Arduino Uno sobre una mesa de trabajo"
                className="h-full w-full object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-[#102a43]/85 via-transparent to-transparent" />
              <div className="absolute bottom-7 left-1/2 w-max -translate-x-1/2 rounded-full border border-white/25 bg-[#102a43]/75 px-5 py-2 text-center text-white backdrop-blur-md">
                <span className="block text-[9px] font-extrabold uppercase tracking-[0.22em] text-[#c7ff64]">
                  Tu dispositivo
                </span>
                <span className="font-display text-xl font-black">
                  Arduino Uno
                </span>
              </div>
              <span className="absolute right-8 top-12 h-4 w-4 rounded-full bg-[#ef6a47] ring-8 ring-white/70" />
            </div>
            <span className="absolute bottom-[1%] left-1/2 -translate-x-1/2 text-[9px] font-bold uppercase tracking-wider text-[#537084]">
              Foto: Harrison Broadbent · Unsplash
            </span>
          </div>
        </section>
      ) : screen === "keyboard" ? (
        <section className="relative z-10 mx-auto max-w-[1180px] px-5 pb-12 pt-5 sm:px-8 lg:px-10">
          <div className="mb-8 flex flex-wrap items-end justify-between gap-5">
            <div>
              <div className="mb-4 flex items-center gap-4 text-sm font-bold">
                <button
                  onClick={() => setScreen("home")}
                  className="text-[#537084] hover:text-[#102a43]"
                >
                  ← Inicio
                </button>
                <button
                  onClick={() => setScreen("remote")}
                  className="flex items-center gap-1.5 text-[#ef6a47] hover:text-[#b44329]"
                >
                  <RemoteIcon className="h-4 w-4" /> Abrir mando
                </button>
              </div>
              <h1 className="font-display text-4xl font-black tracking-[-0.045em] sm:text-6xl">
                Terminal Bluetooth
              </h1>
              <p className="mt-2 text-[#587183]">
                Escribe, envía y supervisa los comandos de tu Arduino en tiempo
                real.
              </p>
            </div>
            <div className="rounded-2xl border border-[#cbd5da] bg-white/60 px-5 py-3">
              <span className="block text-[10px] font-extrabold uppercase tracking-[0.17em] text-[#6c8290]">
                Estado
              </span>
              <span className="mt-1 flex items-center gap-2 text-sm font-bold">
                <span
                  className={`h-2.5 w-2.5 rounded-full ${
                    connection === "connected" ? "bg-[#65a71f]" : "bg-[#ef6a47]"
                  }`}
                />
                {connection === "connected"
                  ? `${deviceName} conectado`
                  : "Modo de prueba local"}
              </span>
            </div>
          </div>

          <div className="overflow-hidden rounded-[2rem] border border-[#27485f] bg-[#0b1720] shadow-[0_14px_0_#77b6c8]">
            <div className="flex flex-wrap items-center justify-between gap-4 border-b border-white/10 bg-[#102a43] px-5 py-4 sm:px-6">
              <div className="flex min-w-0 items-center gap-3">
                <span
                  className={`grid h-10 w-10 shrink-0 place-items-center rounded-full ${
                    connection === "connected"
                      ? "bg-[#c7ff64] text-[#24420d]"
                      : "bg-white/10 text-[#77b6c8]"
                  }`}
                >
                  <BluetoothIcon />
                </span>
                <span className="min-w-0">
                  <span className="block truncate text-sm font-extrabold text-white">
                    {connection === "connected"
                      ? deviceName
                      : "Sin dispositivo"}
                  </span>
                  <span className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.13em] text-[#77b6c8]">
                    <span
                      className={`h-1.5 w-1.5 rounded-full ${
                        connection === "connected"
                          ? "bg-[#c7ff64]"
                          : "bg-[#ef6a47]"
                      }`}
                    />
                    {connection === "connected"
                      ? "Puerto serial conectado"
                      : "Modo de prueba local"}
                  </span>
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="rounded-lg bg-black/20 px-3 py-2 font-mono text-[10px] font-bold text-[#9cb4c2]">
                  RX 0 B <span className="mx-1 text-white/20">·</span> TX{" "}
                  {terminalHistory.reduce(
                    (total, entry) => total + entry.message.length,
                    0,
                  )}{" "}
                  B
                </span>
                <button
                  onClick={connectBluetooth}
                  className="rounded-lg bg-[#c7ff64] px-3 py-2 text-xs font-extrabold text-[#24420d] transition-transform hover:-translate-y-0.5"
                >
                  {connection === "connected" ? "Cambiar" : "Conectar"}
                </button>
              </div>
            </div>

            <div className="relative min-h-[340px] bg-[radial-gradient(circle_at_top_right,#173a55_0,transparent_38%)] p-5 font-mono text-sm sm:min-h-[410px] sm:p-7">
              <div className="pointer-events-none absolute inset-0 opacity-[0.035] [background-image:linear-gradient(rgba(255,255,255,.7)_1px,transparent_1px)] [background-size:100%_24px]" />
              <div className="relative space-y-2 leading-relaxed">
                <p className="text-[#77b6c8]">Tono Uno Serial Terminal</p>
                <p className="text-[#637c8b]">
                  Listo para comunicar a 9600 baud · 8N1
                </p>
                {connection !== "connected" && (
                  <p className="text-[#d9a263]">
                    [INFO] Conecta un HC-05 o HC-06 para comenzar.
                  </p>
                )}
                {terminalHistory.map((entry) => (
                  <div
                    key={entry.id}
                    className="grid grid-cols-[auto_auto_1fr] gap-2"
                  >
                    <span className="text-[#4f6877]">{entry.time}</span>
                    <span className="font-bold text-[#c7ff64]">
                      {entry.direction}›
                    </span>
                    <span className="break-all text-[#eef7f2]">
                      {entry.message}
                    </span>
                  </div>
                ))}
                {!terminalHistory.length && (
                  <p className="pt-6 text-center font-sans text-xs text-[#587180]">
                    Los comandos enviados aparecerán aquí.
                  </p>
                )}
              </div>
            </div>

            <div className="border-t border-white/10 bg-[#0e202c] px-4 py-4 sm:px-6">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-1 rounded-lg bg-black/20 p-1">
                  {(["CR+LF", "LF", "Ninguno"] as LineEnding[]).map(
                    (option) => (
                      <button
                        key={option}
                        onClick={() => setLineEnding(option)}
                        className={`rounded-md px-3 py-1.5 text-[10px] font-extrabold uppercase tracking-wider transition-colors ${
                          lineEnding === option
                            ? "bg-[#77b6c8] text-[#102a43]"
                            : "text-[#77909e] hover:text-white"
                        }`}
                      >
                        {option}
                      </button>
                    ),
                  )}
                </div>
                <button
                  onClick={() => setTerminalHistory([])}
                  className="text-[10px] font-extrabold uppercase tracking-wider text-[#77909e] hover:text-white"
                >
                  Limpiar terminal
                </button>
              </div>

              <form
                className="flex items-center gap-2 rounded-xl border border-[#35566b] bg-[#08131a] p-2 focus-within:border-[#77b6c8]"
                onSubmit={(event) => {
                  event.preventDefault()
                  sendSequence()
                }}
              >
                <span className="pl-2 font-mono font-bold text-[#c7ff64]">
                  &gt;
                </span>
                <input
                  value={sequence.join("")}
                  onChange={(event) =>
                    setSequence(
                      event.target.value.toUpperCase().split("").slice(-64),
                    )
                  }
                  className="min-w-0 flex-1 bg-transparent px-2 py-2 font-mono text-sm text-white outline-none placeholder:text-[#496270]"
                  placeholder="Escribe un comando..."
                  aria-label="Comando para enviar"
                  autoCapitalize="characters"
                />
                <button
                  type="submit"
                  disabled={!sequence.length}
                  className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-[#ef6a47] text-white transition-all enabled:hover:-translate-y-0.5 disabled:opacity-35"
                  aria-label="Enviar comando"
                >
                  <PlayIcon />
                </button>
              </form>

              <div className="mt-4">
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-[10px] font-extrabold uppercase tracking-[0.16em] text-[#77909e]">
                    Teclas rápidas
                  </span>
                  <span className="text-[10px] font-bold text-[#587180]">
                    Toca para añadir y escuchar
                  </span>
                </div>
                <div className="grid grid-cols-7 gap-1.5 sm:grid-cols-[repeat(13,minmax(0,1fr))]">
                  {letters.map((letter) => (
                    <button
                      key={letter}
                      onClick={() => addCommand(letter)}
                      className={`aspect-square rounded-md border font-mono text-xs font-bold transition-all ${
                        activeLetter === letter
                          ? "border-[#c7ff64] bg-[#c7ff64] text-[#102a43]"
                          : "border-[#294b64] bg-[#173a55] text-[#dce9e8] hover:border-[#77b6c8] hover:text-white"
                      }`}
                      aria-label={`Añadir comando ${letter}`}
                    >
                      {letter}
                    </button>
                  ))}
                </div>
              </div>

              <div className="mt-3 flex items-center justify-between text-[10px] text-[#587180]">
                <span>Fin de línea: {lineEnding}</span>
                <span>Último TX: {lastSent || "—"}</span>
              </div>
            </div>
          </div>
        </section>
      ) : (
        <section className="relative z-10 mx-auto max-w-[1100px] px-5 pb-12 pt-5 sm:px-8 lg:px-10">
          <div className="mb-7 flex flex-wrap items-end justify-between gap-5">
            <div>
              <div className="mb-4 flex items-center gap-4 text-sm font-bold">
                <button
                  onClick={() => setScreen("home")}
                  className="text-[#537084] hover:text-[#102a43]"
                >
                  ← Inicio
                </button>
                <button
                  onClick={() => setScreen("keyboard")}
                  className="text-[#ef6a47] hover:text-[#b44329]"
                >
                  Abrir terminal
                </button>
              </div>
              <h1 className="font-display text-4xl font-black tracking-[-0.045em] sm:text-6xl">
                Mando remoto
              </h1>
              <p className="mt-2 text-[#587183]">
                Controla el movimiento de tu auto Arduino.
              </p>
            </div>
            <button
              onClick={connectBluetooth}
              className={`flex items-center gap-2 rounded-full px-5 py-3 text-sm font-extrabold ${
                connection === "connected"
                  ? "bg-[#c7ff64] text-[#284c10]"
                  : "bg-[#102a43] text-white"
              }`}
            >
              <BluetoothIcon />
              {connection === "connected" ? deviceName : "Conectar auto"}
            </button>
          </div>

          <div className="grid gap-5 lg:grid-cols-[1fr_330px]">
            <div className="relative overflow-hidden rounded-[2.2rem] bg-[#102a43] p-6 text-white shadow-[0_12px_0_#77b6c8] sm:p-10">
              <div className="pointer-events-none absolute -right-20 -top-20 h-64 w-64 rounded-full border-[45px] border-[#173a55]" />
              <div className="relative flex items-center justify-between">
                <div>
                  <span className="text-[10px] font-black uppercase tracking-[0.2em] text-[#77b6c8]">
                    Comando actual
                  </span>
                  <p className="mt-1 font-display text-2xl font-black text-[#c7ff64]">
                    {remoteCommand}
                  </p>
                </div>
                <span
                  className={`h-3 w-3 rounded-full ring-4 ${
                    connection === "connected"
                      ? "bg-[#c7ff64] ring-[#c7ff64]/20"
                      : "bg-[#ef6a47] ring-[#ef6a47]/20"
                  }`}
                />
              </div>

              <div className="relative mx-auto mt-8 grid w-full max-w-[430px] grid-cols-3 gap-3">
                <span />
                <button
                  onClick={() => sendRemoteCommand("ADELANTE")}
                  className={`direction-button ${
                    activeDirection === "ADELANTE" ? "active" : ""
                  }`}
                  aria-label="W, avanzar"
                >
                  <span className="flex items-center gap-2">
                    <kbd className="rounded-md border border-white/20 bg-white/10 px-2 py-1 font-sans text-sm font-black">
                      W
                    </kbd>
                    <span className="text-3xl">↑</span>
                  </span>
                  <small>Adelante</small>
                </button>
                <span />
                <button
                  onClick={() => sendRemoteCommand("IZQUIERDA")}
                  className={`direction-button ${
                    activeDirection === "IZQUIERDA" ? "active" : ""
                  }`}
                  aria-label="A, girar a la izquierda"
                >
                  <span className="flex items-center gap-2">
                    <kbd className="rounded-md border border-white/20 bg-white/10 px-2 py-1 font-sans text-sm font-black">
                      A
                    </kbd>
                    <span className="text-3xl">←</span>
                  </span>
                  <small>Izquierda</small>
                </button>
                <button
                  onClick={() => sendRemoteCommand("ALTO")}
                  className="grid aspect-square place-items-center rounded-full border-8 border-[#173a55] bg-[#ef6a47] font-display text-lg font-black text-white shadow-[0_8px_0_#9d3520] transition-all hover:-translate-y-1 active:translate-y-1 active:shadow-none"
                >
                  ALTO
                </button>
                <button
                  onClick={() => sendRemoteCommand("DERECHA")}
                  className={`direction-button ${
                    activeDirection === "DERECHA" ? "active" : ""
                  }`}
                  aria-label="D, girar a la derecha"
                >
                  <span className="flex items-center gap-2">
                    <span className="text-3xl">→</span>
                    <kbd className="rounded-md border border-white/20 bg-white/10 px-2 py-1 font-sans text-sm font-black">
                      D
                    </kbd>
                  </span>
                  <small>Derecha</small>
                </button>
                <span />
                <button
                  onClick={() => sendRemoteCommand("REVERSA")}
                  className={`direction-button ${
                    activeDirection === "REVERSA" ? "active" : ""
                  }`}
                  aria-label="S, retroceder"
                >
                  <span className="flex items-center gap-2">
                    <kbd className="rounded-md border border-white/20 bg-white/10 px-2 py-1 font-sans text-sm font-black">
                      S
                    </kbd>
                    <span className="text-3xl">↓</span>
                  </span>
                  <small>Atrás</small>
                </button>
              </div>
            </div>

            <aside className="flex flex-col gap-5">
              <div className="rounded-[1.7rem] border border-[#d5dcd9] bg-white p-6 shadow-[0_10px_30px_#102a4310]">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-[10px] font-black uppercase tracking-[0.16em] text-[#718592]">
                      Potencia
                    </span>
                    <h2 className="font-display text-xl font-black">
                      Velocidad
                    </h2>
                  </div>
                  <span className="font-display text-3xl font-black text-[#ef6a47]">
                    {speed}%
                  </span>
                </div>
                <input
                  className="speed-slider mt-6 w-full"
                  type="range"
                  min="0"
                  max="100"
                  step="10"
                  value={speed}
                  onChange={(event) => {
                    setSpeed(Number(event.target.value))
                    setRemoteCommand(`VELOCIDAD ${event.target.value}%`)
                  }}
                  aria-label="Velocidad del auto"
                />
                <div className="mt-2 flex justify-between text-[10px] font-bold uppercase tracking-widest text-[#82929c]">
                  <span>Lento</span>
                  <span>Rápido</span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={() => {
                    setLightsOn((current) => !current)
                    setRemoteCommand(lightsOn ? "LUCES OFF" : "LUCES ON")
                  }}
                  className={`rounded-[1.5rem] border-2 p-5 text-left transition-all ${
                    lightsOn
                      ? "border-[#c7ff64] bg-[#c7ff64] text-[#284c10]"
                      : "border-[#d5dcd9] bg-white hover:border-[#77b6c8]"
                  }`}
                >
                  <span className="text-2xl">{lightsOn ? "●" : "○"}</span>
                  <span className="mt-7 block text-sm font-extrabold">
                    Luces
                  </span>
                  <small className="text-[10px] font-bold uppercase tracking-wider opacity-60">
                    {lightsOn ? "Encendidas" : "Apagadas"}
                  </small>
                </button>
                <button
                  onClick={() => sendRemoteCommand("BOCINA")}
                  className="rounded-[1.5rem] border-2 border-[#d5dcd9] bg-white p-5 text-left transition-all hover:-translate-y-1 hover:border-[#ef6a47]"
                >
                  <span className="font-display text-2xl font-black">♪</span>
                  <span className="mt-7 block text-sm font-extrabold">
                    Bocina
                  </span>
                  <small className="text-[10px] font-bold uppercase tracking-wider text-[#82929c]">
                    Tocar tono
                  </small>
                </button>
              </div>

              <p className="rounded-2xl bg-[#e5eff2] px-4 py-3 text-xs leading-relaxed text-[#4b6778]">
                Los controles ya generan comandos visuales. La transmisión final
                dependerá de los comandos que programes en tu Arduino.
              </p>
            </aside>
          </div>
        </section>
      )}

      {devicePanelOpen && (
        <div
          className="fixed inset-0 z-50 grid place-items-center bg-[#102a43]/55 p-5 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-labelledby="device-panel-title"
        >
          <div className="w-full max-w-md rounded-[2rem] border border-white/60 bg-[#f4f1e9] p-6 shadow-[0_24px_80px_#07172580] sm:p-8">
            <div className="flex items-start justify-between gap-5">
              <div>
                <span className="text-[10px] font-black uppercase tracking-[0.18em] text-[#ef6a47]">
                  Bluetooth
                </span>
                <h2
                  id="device-panel-title"
                  className="mt-1 font-display text-3xl font-black tracking-tight"
                >
                  Elige un dispositivo
                </h2>
                <p className="mt-2 text-sm leading-relaxed text-[#587183]">
                  Puedes reconectar uno conocido o buscar dispositivos cercanos.
                </p>
              </div>
              <button
                onClick={() => setDevicePanelOpen(false)}
                className="rounded-full border border-[#cbd5da] px-3 py-2 text-xs font-extrabold hover:bg-white"
              >
                Cerrar
              </button>
            </div>

            <div className="mt-6 space-y-3">
              {knownDevices.length > 0 ? (
                knownDevices.map((device, index) => (
                  <button
                    key={device.id || `${device.name}-${index}`}
                    onClick={() => connectToDevice(device)}
                    className="flex w-full items-center gap-4 rounded-2xl border-2 border-[#d5dcd9] bg-white p-4 text-left transition-all hover:-translate-y-0.5 hover:border-[#77b6c8]"
                  >
                    <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-[#e5eff2] text-[#102a43]">
                      <BluetoothIcon />
                    </span>
                    <span className="min-w-0">
                      <span className="block truncate font-extrabold">
                        {device.name || `Dispositivo ${index + 1}`}
                      </span>
                      <span className="text-xs font-semibold text-[#718592]">
                        {Capacitor.getPlatform() === "android"
                          ? device.address || "Vinculado en Android"
                          : "Autorizado anteriormente"}
                      </span>
                    </span>
                    <span className="ml-auto text-[#ef6a47]">→</span>
                  </button>
                ))
              ) : (
                <div className="rounded-2xl border border-dashed border-[#b9c8ce] bg-white/55 px-5 py-6 text-center">
                  <p className="text-sm font-extrabold">
                    Aún no hay dispositivos guardados
                  </p>
                  <p className="mt-1 text-xs leading-relaxed text-[#718592]">
                    Activa Bluetooth y acerca tu Arduino para encontrarlo.
                  </p>
                </div>
              )}
            </div>

            <button
              onClick={searchBluetoothDevices}
              disabled={connection === "connecting"}
              className="mt-5 flex w-full items-center justify-center gap-3 rounded-2xl bg-[#102a43] px-6 py-4 font-extrabold text-white shadow-[0_6px_0_#77b6c8] transition-all enabled:hover:-translate-y-1 disabled:opacity-60"
            >
              <BluetoothIcon />
              {connection === "connecting"
                ? "Conectando..."
                : Capacitor.getPlatform() === "android"
                  ? "Vincular un dispositivo nuevo"
                  : "Buscar nuevos dispositivos"}
            </button>
            <p className="mt-4 text-center text-[11px] leading-relaxed text-[#718592]">
              {Capacitor.getPlatform() === "android"
                ? "Android abrirá sus ajustes Bluetooth para vincular el HC-05 o HC-06 de forma segura."
                : "Por seguridad, los dispositivos nuevos se muestran en una ventana protegida del navegador."}
            </p>
          </div>
        </div>
      )}

      {downloadPanelOpen && (
        <div
          className="fixed inset-0 z-50 grid place-items-center bg-[#102a43]/60 p-5 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-labelledby="download-panel-title"
        >
          <div className="w-full max-w-md rounded-[2rem] border border-white/60 bg-[#f4f1e9] p-7 text-center shadow-[0_24px_80px_#07172580] sm:p-9">
            <div className="flex items-start justify-between gap-5 text-left">
              <div>
                <span className="text-[10px] font-black uppercase tracking-[0.18em] text-[#ef6a47]">
                  Android
                </span>
                <h2
                  id="download-panel-title"
                  className="mt-1 font-display text-3xl font-black tracking-tight"
                >
                  Descarga Tono Uno
                </h2>
              </div>
              <button
                onClick={() => setDownloadPanelOpen(false)}
                className="rounded-full border border-[#cbd5da] px-3 py-2 text-xs font-extrabold hover:bg-white"
              >
                Cerrar
              </button>
            </div>

            {apkDownloadUrl ? (
              <>
                <div className="mx-auto mt-7 w-fit rounded-[1.7rem] border-4 border-[#77b6c8] bg-white p-4 shadow-[0_8px_0_#102a43]">
                  <QRCodeSVG
                    value={apkDownloadUrl}
                    size={210}
                    bgColor="#ffffff"
                    fgColor="#102a43"
                    level="H"
                    title="Código QR para descargar Tono Uno"
                  />
                </div>
                <p className="mt-7 font-display text-xl font-black">
                  Escanea con la cámara de tu celular
                </p>
                <p className="mx-auto mt-2 max-w-xs text-sm leading-relaxed text-[#587183]">
                  El QR descargará la última versión del APK desde GitHub
                  Releases.
                </p>
                <a
                  href={apkDownloadUrl}
                  className="mt-6 inline-flex items-center gap-2 rounded-2xl bg-[#102a43] px-6 py-3.5 font-extrabold text-white shadow-[0_5px_0_#77b6c8]"
                >
                  Descargar APK <span aria-hidden="true">↓</span>
                </a>
              </>
            ) : (
              <div className="mt-7 rounded-2xl border border-dashed border-[#b9c8ce] bg-white/60 px-6 py-8">
                <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-[#e5eff2] text-[#102a43]">
                  <QrIcon />
                </div>
                <p className="mt-4 font-extrabold">
                  QR pendiente de publicación
                </p>
                <p className="mt-2 text-sm leading-relaxed text-[#718592]">
                  Aparecerá automáticamente cuando el APK se publique mediante
                  GitHub Releases.
                </p>
              </div>
            )}
          </div>
        </div>
      )}
    </main>
  )
}
