/**
 * Maps an abstract urgency string to a concrete JavaScript Date object.
 * @param {string} urgency - The urgency string (e.g. 'ASAP', 'This Week')
 * @returns {Date|null} - The concrete deadline date, or null if unspecified
 */
export function calculateConcreteDeadline(urgency) {
    const today = new Date();
    switch (urgency) {
        case 'ASAP':
            // 1 day from now
            return new Date(today.setDate(today.getDate() + 1));
        case 'This Week':
            // 7 days from now
            return new Date(today.setDate(today.getDate() + 7));
        case 'This Month':
            // 30 days from now
            return new Date(today.setDate(today.getDate() + 30));
        case 'No specific deadline':
        default:
            return null;
    }
}
