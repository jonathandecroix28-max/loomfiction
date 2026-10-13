export function getDeviceId(): string {
  let deviceId = localStorage.getItem('loomfiction_device_id');
  if (!deviceId) {
    deviceId = crypto.randomUUID();
    localStorage.setItem('loomfiction_device_id', deviceId);
  }
  return deviceId;
}