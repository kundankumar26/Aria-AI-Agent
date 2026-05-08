export const getCurrentDateTool = {
    type: "function",
    function: {
        name: "get_current_date",
        description: "Returns today's date. Always call this first.",
        parameters: { type: "object", properties: {} }
    }
};

export function get_current_date() {
    return new Date().toLocaleDateString("en-IN", {
        weekday: "long",
        year: "numeric",
        month: "long",
        day: "numeric"
    });
}