export function jobbotScore({ location, pay, fit, resume }) {
	return Math.round((location + pay + fit + resume) * 10) / 10;
}

export function compareJobbotMatches(a, b) {
	return b.score - a.score || Number(Boolean(b.contact)) - Number(Boolean(a.contact));
}
