// botLoop.js (pseudocode)
while (running) {
  const signal = pickSignal(); // กลยุทธ์ / mock signal
  const order = await iq.placeOrder({
    asset: 'EURUSD',
    side: signal.side, // CALL / PUT
    amount: currentAmount,
    duration: 60, // 1 minute
  });
  const result = await iq.waitResult(order.id);
  updateStats(result);
  await sleep(orderIntervalSec);
}
