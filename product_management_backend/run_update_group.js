import { updatePaymentProgressForGroup } from './orders/order.js';

(async () => {
  try {
    const groupId = process.argv[2] || 'group-1782379040290-26uo29';
    const amount = Number(process.argv[3] || 363);
    console.log('Calling updatePaymentProgressForGroup', groupId, amount);
    const res = await updatePaymentProgressForGroup(groupId, amount, 'cash', 'ref-123', 'test group payment', '1', 'admin', '000', 'admin');
    console.log('RESULT:', res);
  } catch (err) {
    console.error('ERROR', err);
  } finally {
    process.exit(0);
  }
})();
