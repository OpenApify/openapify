import * as OpenApify from '../src/index';
import * as http from 'http';


function createTestServer(content: string): Promise<string> {
    return new Promise(resolve => {
        const server = http.createServer((req: http.IncomingMessage, res: http.ServerResponse) => {
            res.writeHead(200, {'Content-Type': "text/html"});
            res.end(content);
        });
        server.listen({
            port: 0,
            host: '127.0.0.1',
        }, ()=> {
            resolve(`http://127.0.0.1:${server.address().port}`);
        })
    });
}

test('hello world', async () => {
    jasmine.DEFAULT_TIMEOUT_INTERVAL = 999999;
    const addr = await createTestServer('<html><body><p>Hello World!</p></body></html>');

    const result = await OpenApify.Apify((new OpenApify.Job(addr, null, (() => {
        return {
            'Content': document.querySelector('p').innerText,
        }
    }))));

    expect(result).toMatchObject({
        'Content': 'Hello World!'
    });

});
