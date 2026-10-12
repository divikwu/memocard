import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root=fileURLToPath(new URL('.',import.meta.url));
export default defineConfig({
  resolve:{alias:{'@':path.join(root,'src')}},
  plugins:[{
    name:'isolated-ui-preview',enforce:'pre',
    resolveId(source,importer){
      if(!importer || !source.startsWith('.'))return;
      const resolved=path.resolve(path.dirname(importer),source);
      if(resolved === path.join(root,'src/bridge') || resolved === path.join(root,'src/client-mode'))return path.join(root,'preview/bridge.ts');
      if(resolved === path.join(root,'src/browser-runtime'))return path.join(root,'preview/browser-runtime.ts');
    },
    configureServer(server){
      server.middlewares.use((req,res,next)=>{
        // No proxy, service bridge, native handler, external network, or downloads.
        res.setHeader('Content-Security-Policy',"default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' blob:; font-src 'self'; connect-src 'self' ws://127.0.0.1:*; frame-src 'self'; object-src 'none'; base-uri 'none'; form-action 'none'");
        if(req.url?.startsWith('/api/')){res.statusCode=403;res.end('Preview has no real data API');return;}
        if(req.url === '/preview/favicon.png')req.url='/favicon.png';
        next();
      });
    },
  },react(),tailwindcss()],
  server:{host:'127.0.0.1',port:5178,strictPort:true,open:false},
});
