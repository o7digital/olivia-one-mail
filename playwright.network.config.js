import config from './playwright.config.js'
export default { ...config, projects: [{ name: 'webkit', use: { browserName: 'webkit' } }, { name: 'chrome', use: { browserName: 'chromium', channel: 'chrome' } }] }
