import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import fs from 'node:fs/promises'
import path from 'node:path'

function jarvisPlugin() {
  const rootDir = '/Users/sergiuchirau/Desktop/LiquidTodo';
  return {
    name: 'vite-plugin-jarvis',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        if (req.url === '/api/fs/create-folder' && req.method === 'POST') {
          let body = '';
          req.on('data', chunk => body += chunk.toString());
          req.on('end', async () => {
            try {
              const { folderName } = JSON.parse(body);
              const targetPath = path.join(rootDir, folderName);
              if (!targetPath.startsWith(rootDir)) throw new Error("Sandbox violation");
              await fs.mkdir(targetPath, { recursive: true });
              res.statusCode = 200;
              res.end(JSON.stringify({ success: true, path: targetPath }));
            } catch (e) {
              res.statusCode = 500;
              res.end(JSON.stringify({ error: e.message }));
            }
          });
        } else if (req.url === '/api/fs/search' && req.method === 'POST') {
          let body = '';
          req.on('data', chunk => body += chunk.toString());
          req.on('end', async () => {
            try {
              const { query } = JSON.parse(body);
              // Very simple recursive search
              async function walk(dir) {
                let results = [];
                const list = await fs.readdir(dir, { withFileTypes: true });
                for (let file of list) {
                  if (file.isDirectory() && !file.name.includes('node_modules') && !file.name.includes('.git') && !file.name.includes('dist')) {
                    results = results.concat(await walk(path.join(dir, file.name)));
                  } else if (file.isFile() && file.name.toLowerCase().includes(query.toLowerCase())) {
                    results.push(path.join(dir, file.name).replace(rootDir + '/', ''));
                  }
                }
                return results;
              }
              const files = await walk(rootDir);
              res.statusCode = 200;
              res.end(JSON.stringify({ files }));
            } catch (e) {
              res.statusCode = 500;
              res.end(JSON.stringify({ error: e.message }));
            }
          });
        } else if (req.url === '/api/fs/save-tasks' && req.method === 'POST') {
          let body = '';
          req.on('data', chunk => body += chunk.toString());
          req.on('end', async () => {
            try {
              const { tasks } = JSON.parse(body);
              const vaultDir = path.join(rootDir, 'vault');
              const targetPath = path.join(vaultDir, 'tasks.json');

              await fs.mkdir(vaultDir, { recursive: true });
              await fs.writeFile(targetPath, JSON.stringify(tasks, null, 2));
              res.statusCode = 200;
              res.end(JSON.stringify({ success: true }));
            } catch (e) {
              res.statusCode = 500;
              res.end(JSON.stringify({ error: e.message }));
            }
          });
        } else if (req.url === '/api/fs/load-tasks' && req.method === 'GET') {
          try {
            const targetPath = path.join(rootDir, 'vault', 'tasks.json');
            const data = await fs.readFile(targetPath, 'utf8');
            res.statusCode = 200;
            res.end(JSON.stringify({ tasks: JSON.parse(data) }));
          } catch (e) {
            if (e.code === 'ENOENT') {
              res.statusCode = 200;
              res.end(JSON.stringify({ tasks: null })); // Signal no file yet
            } else {
              res.statusCode = 500;
              res.end(JSON.stringify({ error: e.message }));
            }
          }
        } else if (req.url === '/api/fs/save-chat-log' && req.method === 'POST') {
          let body = '';
          req.on('data', chunk => body += chunk.toString());
          req.on('end', async () => {
            try {
              const { projectId, logData } = JSON.parse(body);
              const projectDir = path.join(rootDir, 'vault', 'projects', projectId);
              await fs.mkdir(projectDir, { recursive: true });

              const filename = `session-${Date.now()}.json`;
              const targetPath = path.join(projectDir, filename);

              await fs.writeFile(targetPath, JSON.stringify(logData, null, 2));
              res.statusCode = 200;
              res.end(JSON.stringify({ success: true, filename }));
            } catch (e) {
              res.statusCode = 500;
              res.end(JSON.stringify({ error: e.message }));
            }
          });
        } else if (req.url.startsWith('/api/fs/load-chat-logs') && req.method === 'GET') {
          try {
            const urlObj = new URL(req.url, `http://${req.headers.host}`);
            const projectId = urlObj.searchParams.get('projectId');
            if (!projectId) throw new Error("Missing projectId");

            const projectDir = path.join(rootDir, 'vault', 'projects', projectId);

            try {
              const files = await fs.readdir(projectDir);
              const jsonFiles = files.filter(f => f.endsWith('.json'));

              let logs = [];
              for (let file of jsonFiles) {
                const content = await fs.readFile(path.join(projectDir, file), 'utf8');
                logs.push({ filename: file, data: JSON.parse(content) });
              }

              // Sort newest first
              logs.sort((a, b) => b.filename.localeCompare(a.filename));

              res.statusCode = 200;
              res.end(JSON.stringify({ logs }));
            } catch (e) {
              if (e.code === 'ENOENT') {
                // Folder doesn't exist yet, return empty logs
                res.statusCode = 200;
                res.end(JSON.stringify({ logs: [] }));
              } else {
                throw e;
              }
            }
          } catch (e) {
            res.statusCode = 500;
            res.end(JSON.stringify({ error: e.message }));
          }
        } else if (req.url === '/api/fs/archive-logs' && req.method === 'POST') {
          let body = '';
          req.on('data', chunk => body += chunk.toString());
          req.on('end', async () => {
            try {
              const { projectId } = JSON.parse(body);
              const projectDir = path.join(rootDir, 'vault', 'projects', projectId);
              const archiveDir = path.join(rootDir, 'vault', 'archive', projectId);

              try {
                await fs.mkdir(archiveDir, { recursive: true });
                const files = await fs.readdir(projectDir);
                const jsonFiles = files.filter(f => f.endsWith('.json'));

                const THIRTY_DAYS = 30 * 24 * 60 * 60 * 1000;
                const now = Date.now();
                let archivedCount = 0;

                for (let file of jsonFiles) {
                  // Extract timestamp from 'session-1730000000.json'
                  const match = file.match(/session-(\d+)\.json/);
                  if (match) {
                    const timestamp = parseInt(match[1]);
                    if (now - timestamp > THIRTY_DAYS) {
                      await fs.rename(path.join(projectDir, file), path.join(archiveDir, file));
                      archivedCount++;
                    }
                  }
                }
                res.statusCode = 200;
                res.end(JSON.stringify({ success: true, archivedCount }));
              } catch (e) {
                if (e.code === 'ENOENT') {
                  res.statusCode = 200;
                  res.end(JSON.stringify({ success: true, archivedCount: 0 }));
                } else {
                  throw e;
                }
              }
            } catch (e) {
              res.statusCode = 500;
              res.end(JSON.stringify({ error: e.message }));
            }
          });
        } else if (req.url === '/api/fs/save-financial' && req.method === 'POST') {
          let body = '';
          req.on('data', chunk => body += chunk.toString());
          req.on('end', async () => {
            try {
              const { financial } = JSON.parse(body);
              const vaultDir = path.join(rootDir, 'vault');
              await fs.mkdir(vaultDir, { recursive: true });
              await fs.writeFile(path.join(vaultDir, 'financial.json'), JSON.stringify(financial, null, 2));
              res.statusCode = 200;
              res.end(JSON.stringify({ success: true }));
            } catch (e) {
              res.statusCode = 500;
              res.end(JSON.stringify({ error: e.message }));
            }
          });
        } else if (req.url === '/api/fs/load-financial' && req.method === 'GET') {
          try {
            const data = await fs.readFile(path.join(rootDir, 'vault', 'financial.json'), 'utf8');
            res.statusCode = 200;
            res.end(JSON.stringify({ financial: JSON.parse(data) }));
          } catch (e) {
            res.statusCode = 200;
            res.end(JSON.stringify({ financial: null }));
          }
        } else {
          next();
        }
      });
    }
  }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), jarvisPlugin()],
})
