const logger = require('../utils/logger');

const queue = [];
let scheduled = false;
let processing = false;

const flushQueue = async () => {
    if (processing) return;
    processing = true;
    scheduled = false;

    try {
        while (queue.length > 0) {
            const task = queue.shift();
            try {
                await task();
            } catch (error) {
                logger.error('track queue task failed', error);
            }
        }
    } finally {
        processing = false;
        if (queue.length > 0 && !scheduled) {
            scheduled = true;
            setImmediate(flushQueue);
        }
    }
};

const queueBehaviorTask = (task) => {
    queue.push(task);
    if (!scheduled) {
        scheduled = true;
        setImmediate(flushQueue);
    }
};

module.exports = {
    queueBehaviorTask,
};