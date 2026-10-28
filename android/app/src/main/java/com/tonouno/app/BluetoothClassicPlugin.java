package com.tonouno.app;

import android.Manifest;
import android.bluetooth.BluetoothAdapter;
import android.bluetooth.BluetoothDevice;
import android.bluetooth.BluetoothManager;
import android.bluetooth.BluetoothSocket;
import android.content.Context;
import android.content.Intent;
import android.os.Build;
import android.provider.Settings;
import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.PermissionState;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;
import java.io.IOException;
import java.io.OutputStream;
import java.nio.charset.StandardCharsets;
import java.util.Set;
import java.util.UUID;

@CapacitorPlugin(
    name = "BluetoothClassic",
    permissions = {
        @Permission(
            alias = "bluetooth",
            strings = {
                Manifest.permission.BLUETOOTH_CONNECT,
                Manifest.permission.BLUETOOTH_SCAN
            }
        )
    }
)
public class BluetoothClassicPlugin extends Plugin {
    private static final UUID SERIAL_PORT_UUID = UUID.fromString("00001101-0000-1000-8000-00805F9B34FB");
    private final Object socketLock = new Object();
    private volatile BluetoothSocket socket;

    private BluetoothAdapter getAdapter() {
        BluetoothManager manager = (BluetoothManager) getContext().getSystemService(Context.BLUETOOTH_SERVICE);
        return manager == null ? null : manager.getAdapter();
    }

    @PluginMethod
    public void requestPermissions(PluginCall call) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.S || getPermissionState("bluetooth") == PermissionState.GRANTED) {
            call.resolve();
            return;
        }
        requestPermissionForAlias("bluetooth", call, "permissionsCallback");
    }

    @PermissionCallback
    private void permissionsCallback(PluginCall call) {
        if (getPermissionState("bluetooth") == PermissionState.GRANTED) {
            call.resolve();
        } else {
            call.reject("Se necesitan permisos Bluetooth.");
        }
    }

    @PluginMethod
    public void listPairedDevices(PluginCall call) {
        BluetoothAdapter adapter = getAdapter();
        if (adapter == null) {
            call.reject("Este dispositivo no tiene Bluetooth.");
            return;
        }
        if (!adapter.isEnabled()) {
            call.reject("Bluetooth está apagado.");
            return;
        }

        try {
            Set<BluetoothDevice> bondedDevices = adapter.getBondedDevices();
            JSArray devices = new JSArray();
            for (BluetoothDevice device : bondedDevices) {
                JSObject item = new JSObject();
                item.put("name", device.getName());
                item.put("address", device.getAddress());
                item.put("id", device.getAddress());
                devices.put(item);
            }
            JSObject result = new JSObject();
            result.put("devices", devices);
            call.resolve(result);
        } catch (SecurityException exception) {
            call.reject("No hay permiso para consultar dispositivos Bluetooth.", exception);
        }
    }

    @PluginMethod
    public void connect(PluginCall call) {
        String address = call.getString("address");
        BluetoothAdapter adapter = getAdapter();
        if (adapter == null || address == null) {
            call.reject("Dirección Bluetooth no válida.");
            return;
        }

        new Thread(() -> {
            BluetoothSocket newSocket = null;
            try {
                BluetoothDevice device = adapter.getRemoteDevice(address);
                newSocket = device.createRfcommSocketToServiceRecord(SERIAL_PORT_UUID);
                adapter.cancelDiscovery();
                newSocket.connect();
                synchronized (socketLock) {
                    closeSocket();
                    socket = newSocket;
                }
                call.resolve();
            } catch (IOException | SecurityException exception) {
                if (newSocket != null) {
                    try {
                        newSocket.close();
                    } catch (IOException ignored) {
                        // The failed socket is already closed.
                    }
                }
                call.reject("No se pudo conectar con el módulo Bluetooth.", exception);
            }
        }).start();
    }

    @PluginMethod
    public void write(PluginCall call) {
        String data = call.getString("data");
        if (data == null || data.isEmpty()) {
            call.reject("No hay datos para enviar.");
            return;
        }

        new Thread(() -> {
            try {
                byte[] bytes = data.getBytes(StandardCharsets.UTF_8);
                synchronized (socketLock) {
                    if (socket == null || !socket.isConnected()) {
                        call.reject("El dispositivo Bluetooth no está conectado.");
                        return;
                    }
                    OutputStream output = socket.getOutputStream();
                    output.write(bytes);
                    output.flush();
                }
                JSObject result = new JSObject();
                result.put("bytesWritten", bytes.length);
                call.resolve(result);
            } catch (IOException | SecurityException exception) {
                synchronized (socketLock) {
                    closeSocket();
                }
                call.reject("No se pudo enviar el comando por Bluetooth.", exception);
            }
        }).start();
    }

    @PluginMethod
    public void openSettings(PluginCall call) {
        Intent intent = new Intent(Settings.ACTION_BLUETOOTH_SETTINGS);
        intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        getContext().startActivity(intent);
        call.resolve();
    }

    @Override
    protected void handleOnDestroy() {
        synchronized (socketLock) {
            closeSocket();
        }
        super.handleOnDestroy();
    }

    private void closeSocket() {
        if (socket != null) {
            try {
                socket.close();
            } catch (IOException ignored) {
                // The socket is already closed.
            } finally {
                socket = null;
            }
        }
    }
}
