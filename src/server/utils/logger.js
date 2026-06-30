import console from 'console';

let loggerInstance = console;

try {
    const { default: pino } = await import('pino');
    loggerInstance = pino();
} catch (e) {
    loggerInstance = console;
}

export default loggerInstance;
