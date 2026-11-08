/**
 * Village-friendly Toast notification utility for FemmeFlo mobile app.
 * Provides simple, clear, jargon-free English messages tailored for rural sellers and field staff.
 */

export function showToast(message: string, duration: 'short' | 'long' = 'short'): void {
  try {
    // Dynamic access to avoid breaking pure Node.js environments/test runners
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const RN = require('react-native');
    if (RN?.Platform?.OS === 'android' && RN?.ToastAndroid?.show) {
      RN.ToastAndroid.show(
        message,
        duration === 'long' ? RN.ToastAndroid.LONG : RN.ToastAndroid.SHORT
      );
    } else if (RN?.Alert?.alert) {
      RN.Alert.alert('', message);
    }
  } catch {
    // Fallback for headless test environments or when react-native is not bundled
  }
}

/**
 * Pre-defined simple English toasts designed for easy comprehension by village field staff.
 */
export const VillageToasts = {
  // Duty / Shift
  shiftStarted: (km?: number) =>
    km !== undefined ? `Duty Started! Meter: ${km} km` : 'Duty Started! Good luck.',
  shiftEnded: (km?: number) =>
    km !== undefined ? `Duty Finished! Travelled: ${km} km` : 'Duty Finished! Have a good rest.',
  meterRequired: () => 'Please enter your bike meter reading.',
  selfieRequired: () => 'Please take your selfie photo.',
  needStartShift: () => 'Please start duty first before doing sales.',

  // Shop Visits
  visitCheckedIn: (shopName?: string) =>
    shopName ? `Checked in at ${shopName}!` : 'Shop Visit Started!',
  visitCheckedOut: (shopName?: string) =>
    shopName ? `Finished visit at ${shopName}!` : 'Shop Visit Completed!',
  alreadyCheckedOut: () => 'You already finished this shop visit.',
  selectCustomerFirst: () => 'Please choose the shop name first.',

  // Sales & Orders
  saleRecorded: () => 'Sale Done! Bill saved.',
  emptyCart: () => 'Cart is empty. Add at least 1 packet.',
  priceSentForApproval: () => 'Discounted Price: Sent to Office for approval.',
  paymentReceived: () => 'Cash Received! Payment marked as Done.',
  paymentPending: () => 'Bill saved as Credit (Unpaid).',

  // Customer Onboarding
  customerAdded: (name?: string) =>
    name ? `${name} added successfully!` : 'New Shop Added!',
  fillRequiredFields: () => 'Please fill all details marked with *',
  validPhoneRequired: () => 'Please enter a valid 10-digit mobile number.',
  photoSaved: () => 'Shop photo saved!',

  // Stock / Inventory
  stockTransferred: () => 'Stock Moved! Packets sent to depot.',
  stockReceived: (pkts?: number) =>
    pkts ? `${pkts.toLocaleString('en-IN')} packets added to HQ stock!` : 'Stock Inward Done!',
  warehouseAdded: (name?: string) =>
    name ? `${name} warehouse added!` : 'New Warehouse Added!',
  notEnoughStock: () => 'Not enough packets in stock.',

  // Approvals & Office
  saleApproved: () => 'Sale Approved by Office!',
  saleRejected: () => 'Sale Cancelled by Office.',
  permissionsSaved: () => 'Permissions saved successfully.',
  passwordChanged: () => 'Password changed! Please remember it.',

  // Internet & Offline Mode
  noInternet: () => 'No Internet! Working in Offline Mode.',
  savedToPhone: () => 'Saved to phone! Will upload when network comes.',
  dataSynced: () => 'All data sent to office successfully!',
  gpsFound: () => 'GPS Location Found!',
  gpsNeeded: () => 'Turn on GPS and stand in open area.',
  cameraPermissionNeeded: () => 'Please allow Camera in phone settings.',
};
