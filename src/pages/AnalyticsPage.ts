import { Analytics } from '../components/Analytics';

export function renderAnalyticsPage(role: 'pro' | 'ops' | 'staff' | 'empresa', professionalId: string = '1'): string {
  return `
    <div class="analytics-page" id="analytics-${role}">
      ${Analytics({ role, professionalId })}
    </div>
  `;
}