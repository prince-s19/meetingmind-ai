import { GeminiService } from './src/services/gemini.js';
GeminiService.generateSummary('Hello this is a test.').then(console.log).catch(console.error);
GeminiService.extractTasks('John: do this.').then(console.log).catch(console.error);
