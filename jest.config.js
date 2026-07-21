// jest.config.js
//
// Extends the default @salesforce/sfdx-lwc-jest preset.
// The preset handles:
//   - Resolving @salesforce/* and c/* module aliases
//   - Transforming LWC HTML/JS/CSS files via Babel
//   - Setting up the jsdom test environment
//
// Place this file at the repository root alongside package.json.

module.exports = {
    preset: '@salesforce/sfdx-lwc-jest/preset',

    // Collect coverage from all component JS files, not just tested ones.
    collectCoverageFrom: [
        'force-app/main/default/lwc/**/*.js',
        '!force-app/main/default/lwc/**/__tests__/**',
        '!force-app/main/default/lwc/**/jsconfig.json'
    ],

    // Coverage thresholds — adjust per team requirements.
    coverageThreshold: {
        global: {
            statements: 50,
            branches: 40,
            functions: 50,
            lines: 50
        }
    }
};