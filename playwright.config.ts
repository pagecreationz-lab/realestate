import {defineConfig} from '@playwright/test';
export default defineConfig({testDir:'./tests/browser',workers:1,use:{baseURL:'http://localhost:3100',channel:'msedge',headless:true},webServer:{command:'npm run dev:web -- --port 3100 --strictPort',url:'http://localhost:3100',reuseExistingServer:true},reporter:'list'});
