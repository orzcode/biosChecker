export async function today() {
    const now = new Date();
    return `${now.getFullYear()}/${now.getMonth() + 1}/${now.getDate()}`;
	//returns YYYY/M/D
	//ASRock uses this format - strips leading zero from month and day.
}

export async function formatToYYYYMD(date) {
    const d = new Date(date);

    // Check if the date is valid
    if (isNaN(d)) {
        throw new Error("Invalid date input");
    }

    return `${d.getFullYear()}/${d.getMonth() + 1}/${d.getDate()}`;
}
