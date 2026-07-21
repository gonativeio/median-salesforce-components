// jest.config.js
//
// Builds on the base config shipped by @salesforce/sfdx-lwc-jest, which handles
// resolving @salesforce/* and c/* module aliases, transforming LWC HTML/JS/CSS,
// and setting up the jsdom test environment.
//
// This is the single Jest config for the project — do not also add a "jest" key
// in package.json, or Jest will refuse to run ("Multiple configurations found").

const { jestConfig } = require('@salesforce/sfdx-lwc-jest/config');

module.exports = {
    ...jestConfig,

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
