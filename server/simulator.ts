import crypto from 'node:crypto';
import { db, listSitePages, recordIngestedEvent } from './db.js';

export type BroadcastFn = (siteId: string, payload: unknown) => void;

const DEMO_REGIONS = ['North America', 'Europe', 'Asia-Pacific', 'South America', 'Oceania'];
const DEMO_DEVICES: Array<'desktop' | 'mobile' | 'tablet'> = ['desktop', 'desktop', 'mobile', 'tablet'];

export function startDemoSimulator(broadcast: BroadcastFn) {
  const interval = setInterval(() => {
    try {
      const sites = db
        .prepare("SELECT id, domain, collection_paused, demo_mode, status FROM sites WHERE demo_mode = 1 AND collection_paused = 0 AND status = 'connected'")
        .all() as Array<{ id: string; domain: string }>;

      for (const site of sites) {
        const pages = listSitePages(site.id, false);
        if (pages.length < 2) continue;

        const activeSessions = db
          .prepare('SELECT anon_session_id, masked_ip, region, device_type, current_path FROM visitor_sessions WHERE site_id = ? AND is_active = 1 AND is_demo = 1 ORDER BY last_seen_at ASC LIMIT 12')
          .all(site.id) as Array<{
          anon_session_id: string;
          masked_ip: string;
          region: string;
          device_type: 'desktop' | 'mobile' | 'tablet';
          current_path: string;
        }>;

        // 75% move an existing demo visitor, 25% spawn a fresh anonymous demo session
        const shouldSpawn = activeSessions.length < 6 || (activeSessions.length < 11 && Math.random() < 0.25);
        let sessionId: string;
        let maskedIp: string;
        let region: string;
        let deviceType: 'desktop' | 'mobile' | 'tablet';
        let prevPath: string | null = null;
        let nextPath: string;
        let eventType: string;
        let note: string | null = null;

        if (shouldSpawn) {
          sessionId = `v_${crypto.randomBytes(4).toString('hex')}`;
          maskedIp = `***.***.${Math.floor(15 + Math.random() * 220)}.**`;
          region = DEMO_REGIONS[Math.floor(Math.random() * DEMO_REGIONS.length)];
          deviceType = DEMO_DEVICES[Math.floor(Math.random() * DEMO_DEVICES.length)];
          nextPath = pages[0].path;
          eventType = 'Session Start';
        } else {
          // Pick a visitor (avoid constantly disrupting featured v_8f3d2a7c unless needed, keep its flow clean)
          const candidates = activeSessions.filter((s) => s.anon_session_id !== 'v_8f3d2a7c');
          const picked = (candidates.length ? candidates : activeSessions)[
            Math.floor(Math.random() * (candidates.length ? candidates.length : activeSessions.length))
          ];
          sessionId = picked.anon_session_id;
          maskedIp = picked.masked_ip;
          region = picked.region;
          deviceType = picked.device_type;
          prevPath = picked.current_path;

          const otherPages = pages.filter((p) => p.path !== prevPath);
          const target = otherPages[Math.floor(Math.random() * otherPages.length)] || pages[0];
          nextPath = target.path;

          if (nextPath === '/login' || nextPath === '/account') {
            eventType = 'Auth Metadata';
            note = 'Login event recorded — credentials redacted.';
          } else {
            eventType = Math.random() < 0.45 ? 'SPA Navigation' : 'Page View';
          }
        }

        const recorded = recordIngestedEvent({
          siteId: site.id,
          sessionId,
          maskedIp,
          region,
          deviceType,
          eventType,
          path: nextPath,
          previousPath: prevPath,
          latencyMs: Math.floor(54 + Math.random() * 44),
          metadataNote: note,
          isDemo: true,
        });

        broadcast(site.id, {
          type: 'event',
          event: recorded.event,
          discoveredNewPage: recorded.discoveredNewPage,
        });
      }
    } catch (err) {
      console.error('[DemoSimulator] Error:', err);
    }
  }, 3400);

  return () => clearInterval(interval);
}
