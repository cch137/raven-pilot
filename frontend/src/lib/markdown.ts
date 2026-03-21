import { marked } from 'marked';
import DOMPurify from 'dompurify';

marked.setOptions({ gfm: true, breaks: true });

function escapeHtml(text: string): string {
	return String(text)
		.replaceAll('&', '&amp;')
		.replaceAll('<', '&lt;')
		.replaceAll('>', '&gt;')
		.replaceAll('"', '&quot;')
		.replaceAll("'", '&#39;');
}

export function renderMarkdown(content: string): string {
	const text = String(content ?? '');
	try {
		const raw = marked.parse(text) as string;
		const sanitized = DOMPurify.sanitize(raw);
		// open links in new tab
		const template = document.createElement('template');
		template.innerHTML = sanitized;
		template.content.querySelectorAll('a').forEach((a) => {
			a.target = '_blank';
			a.rel = 'noreferrer noopener';
		});
		return template.innerHTML || `<p>${escapeHtml(text).replace(/\n/g, '<br>')}</p>`;
	} catch {
		return `<p>${escapeHtml(text).replace(/\n/g, '<br>')}</p>`;
	}
}

export function timeLabel(value: string): string {
	const date = new Date(value);
	if (Number.isNaN(date.getTime())) return '';
	return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}
