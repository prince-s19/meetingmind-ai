import { PDFParse } from 'pdf-parse';
import fs from 'fs/promises';
import path from 'path';
import { encryptData, hashFile } from '../utils/encryption.js';

export class FileHandler {
    /**
     * Process uploaded file (PDF or TXT)
     */
    static async processFile(fileBuffer, fileName) {
        try {
            let text;

            if (fileName.endsWith('.pdf')) {
                // Extract text from PDF using PDFParse v2
                const parser = new PDFParse({ data: fileBuffer });
                const result = await parser.getText();
                text = result.text;
            } else if (fileName.endsWith('.txt')) {
                // Read TXT file
                text = fileBuffer.toString('utf-8');
            } else {
                throw new Error('Unsupported file type. Use PDF or TXT.');
            }

            // Clean text
            const cleanedText = this.cleanText(text);

            if (cleanedText.length < 100) {
                throw new Error('Transcript too short. Minimum 100 characters.');
            }

            // Extract speakers from transcript (simple heuristic)
            const speakers = this.extractSpeakers(cleanedText);

            // Encrypt text for storage
            const encryptedText = encryptData(cleanedText);

            // Create file hash
            const fileHash = hashFile(fileBuffer);

            return {
                success: true,
                originalText: cleanedText,
                encryptedText,
                fileHash,
                speakers,
                characterCount: cleanedText.length,
                wordCount: cleanedText.split(/\s+/).length,
            };
        } catch (error) {
            throw new Error(`File processing failed: ${error.message}`);
        }
    }

    /**
     * Clean transcript text
     */
    static cleanText(text) {
        return text
            .replace(/\n\n+/g, '\n') // Remove extra newlines
            .replace(/\[.*?\]/g, '') // Remove timestamps [00:00:00]
            .replace(/\{\{.*?\}\}/g, '') // Remove markers
            .trim();
    }

    /**
     * Extract speaker names from transcript
     * Looks for patterns like "John: ..." or "[John]"
     */
    static extractSpeakers(text) {
        const speakerPatterns = [
            /^([A-Z][a-z]+):/gm, // "John: ..."
            /\[([A-Z][a-z]+)\]/gm, // "[John]"
            /([A-Z][a-z]+)\s+said:/gi, // "John said:"
        ];

        const speakers = new Set();

        speakerPatterns.forEach((pattern) => {
            const matches = text.matchAll(pattern);
            for (const match of matches) {
                speakers.add(match[1]);
            }
        });

        return Array.from(speakers).slice(0, 10); // Limit to 10 speakers
    }

    /**
     * Store file locally (for demo; use Firebase/S3 in production)
     */
    static async storeFile(encryptedData, fileName) {
        try {
            const uploadDir = path.join(process.cwd(), 'uploads');
            await fs.mkdir(uploadDir, { recursive: true });

            const filePath = path.join(uploadDir, `${Date.now()}_${fileName}.enc`);
            await fs.writeFile(filePath, encryptedData);

            return filePath;
        } catch (error) {
            throw new Error(`File storage failed: ${error.message}`);
        }
    }
}