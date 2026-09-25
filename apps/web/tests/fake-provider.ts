import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';

/** A tiny OpenAI-compatible server for tests. Records every request it receives. */
export async function fakeProvider(): Promise<{
  url: string;
  requests: string[];
  close: () => void;
}> {
  const requests: string[] = [];
  const server: Server = createServer(async (req, res) => {
    let body = '';
    for await (const chunk of req) body += chunk;
    requests.push(`${req.method} ${req.url}`);
    if (req.url === '/v1/models') {
      res.setHeader('content-type', 'application/json');
      res.end(JSON.stringify({ data: [{ id: 'fake-large' }, { id: 'fake-mini' }] }));
      return;
    }
    if (req.url === '/v1/chat/completions') {
      const data = JSON.parse(body) as { stream?: boolean; messages: { content: string }[] };
      const system = data.messages[0]?.content ?? '';
      const user = data.messages[1]?.content ?? '';
      if (data.stream) {
        res.setHeader('content-type', 'text/event-stream');
        for (const piece of ['The new tool ', 'helps us ', 'decide.']) {
          res.write(`data: ${JSON.stringify({ choices: [{ delta: { content: piece } }] })}\n\n`);
        }
        res.end('data: [DONE]\n\n');
        return;
      }
      let content = 'OK';
      if (system.includes('"edits"')) {
        content = JSON.stringify({
          edits: user.includes('went well')
            ? [
                {
                  find: 'went well',
                  before: 'The meeting',
                  replace: 'went smoothly',
                  category: 'clarity',
                  title: 'Be more specific',
                  explanation: 'Say how it went.',
                },
              ]
            : [],
        });
      }
      res.setHeader('content-type', 'application/json');
      res.end(JSON.stringify({ choices: [{ message: { content } }] }));
      return;
    }
    res.statusCode = 404;
    res.end();
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const port = (server.address() as AddressInfo).port;
  return { url: `http://localhost:${port}/v1`, requests, close: () => server.close() };
}
