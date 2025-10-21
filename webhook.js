const express = require('express');
const app = express();
const { PubSub } = require('@google-cloud/pubsub');
const cors = require('cors');
let bodyParser = require('body-parser');

// Set detault timezone to utc
process.env.TZ = 'UTC';

// Init pubsub.
let topic = 'projects/buzzhq/topics/scrapp-result-webhook';
console.info('Pubsub Connecting. On topic:', topic);
const pubsubClient = new PubSub();
const producer = pubsubClient.topic(topic);
console.info('Pubsub Connected.');

// Add Middlewares
app.use(
  cors({
    origin: true,
    credentials: true,
  })
);
// Parse JSON Body.
app.use(
  bodyParser.json({
    limit: '5mb',
  })
);

app.post('/scrap-webhook', async (req, res) => {
  try {
    let payload = JSON.stringify(req.body ? req.body : {});
    console.log('Pushing webhook payload to pubsub', payload);
    await producer.publish(Buffer.from(payload));

    res.json({ status: 'ok' });
  } catch (err) {
    console.error('Error: Webhook to pubsub push failed. Payload:', JSON.stringify(req.body));
    console.error('Error Detail: ', err);
  }
});

app.get('/scrap-webhook', async (req, res) => {
  try {
    let payload = JSON.stringify(req.query ? req.query : {});
    console.log('Pushing webhook payload to pubsub', payload);
    await producer.publish(Buffer.from(payload));

    res.json({ status: 'ok' });
  } catch (err) {
    console.error('Error: Webhook to pubsub push failed. Payload:', JSON.stringify(req.body));
    console.error('Error Detail: ', err);
  }
});

// Health endpoint
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    service: 'webhook-server',
  });
});

const PORT = process.env.PORT || 6429;
console.log('Start server at port:', PORT);
app.listen(PORT, () => {
  console.log(`Webhook server running on port ${PORT}`);
});
