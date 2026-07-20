import { LightningElement, track } from 'lwc';

export default class DocumentScannerNative extends LightningElement {

    @track scannedImage;
    @track error;

    launchScanner() {

        this.error = null;

        if (!window.median || !window.median.documentScanner) {
            this.error = 'Document scanner only works inside Median mobile app.';
            return;
        }

        // IMPORTANT: callback must be global
        window.handleMedianScan = this.handleScanResult.bind(this);

        window.median.documentScanner.scanPage({
            callback: 'handleMedianScan'
        });
    }

    handleScanResult(data) {

        try {

            if (!data || !data.image) {
                this.error = 'No image returned from scanner.';
                return;
            }

            // Build usable image URL
            this.scannedImage =
                `data:${data.mimeType};${data.encoding},${data.image}`;

        } catch (e) {
            console.error(e);
            this.error = 'Failed to process scanned image.';
        }
    }
}
