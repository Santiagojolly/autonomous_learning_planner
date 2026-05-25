import { useEffect, useRef, useCallback } from "react";
import { toast } from "sonner";
import { API, type CalendarEvent } from "../api";
import { useAuth } from "../../context/AuthContext";

/**
 * GuardianAgent (Proactive Advisor)
 * - Autonomously monitors the user's schedule.
 * - Triggers "Check-in" reminders 10m before a session begins.
 * - Detects missed sessions in REAL-TIME and suggests corrective actions.
 * - Proactively alerts if the streak is at risk.
 */
export function useGuardianAgent() {
    const { isAuthenticated, user } = useAuth();
    const lastCheckTime = useRef<number>(0);
    const notifiedEventIds = useRef<Set<string>>(new Set());
    const isRunning = useRef<boolean>(false);

    const checkSchedule = useCallback(async (isForce = false) => {
        if (!isAuthenticated || (isRunning.current && !isForce)) return;
        
        // Only run every 60 seconds to conserve local resources, unless forced
        const now = Date.now();
        if (!isForce && now - lastCheckTime.current < 60000) return;
        lastCheckTime.current = now;

        isRunning.current = true;
        try {
            const data = await API.getCalendarEvents();
            const events = data.events || [];
            const todayISO = new Date().toISOString().split('T')[0];
            const nowTime = new Date();

            // 1. Check for APPROACHING sessions (proactive check-in)
            const upcoming = events.find(e => {
                if (e.date !== todayISO || e.completed || e.sessionType === "Busy") return false;
                if (notifiedEventIds.current.has(e.id)) return false;

                const [h, m] = e.startTime.split(':').map(Number);
                const startTime = new Date();
                startTime.setHours(h, m, 0, 0);

                const diffMs = startTime.getTime() - nowTime.getTime();
                const diffMin = diffMs / 60000;

                // Notify if session starts in 0-15 minutes
                return diffMin > 0 && diffMin <= 15;
            });

            if (upcoming) {
                notifiedEventIds.current.add(upcoming.id);
                toast.info(`Guardian: Your '${upcoming.topic}' session starts soon.`, {
                    description: `Ready to start? The materials are already curated for you.`,
                    duration: 10000,
                });
            }

            // 2. Check for MISSED sessions (streak alert)
            const missedToday = events.filter(e => {
                if (e.date !== todayISO || e.completed || e.sessionType === "Busy") return false;
                if (notifiedEventIds.current.has(`${e.id}_missed`)) return false;

                const [h, m] = e.startTime.split(':').map(Number);
                const startTime = new Date();
                startTime.setHours(h, m, 0, 0);

                // If session started 5+ minutes ago and not completed
                return nowTime.getTime() > (startTime.getTime() + 300000); 
            });

            if (missedToday.length > 0) {
                const first = missedToday[0];
                notifiedEventIds.current.add(`${first.id}_missed`);
                console.log(`[GuardianAgent] Alerting for missed session: ${first.topic} at ${first.startTime}`);
                toast.error(`Guardian: Streak at Risk!`, {
                    description: `You've missed your '${first.topic}' session (scheduled for ${first.startTime}). I've flagged this for rescheduling.`,
                    id: `missed-session-${first.id}`, // Very specific ID to prevent overlap
                    duration: 12000,
                });
            }

        } catch (err) {
            console.warn("[GuardianAgent] Internal check failed", err);
        } finally {
            isRunning.current = false;
        }
    }, [isAuthenticated]);

    useEffect(() => {
        if (!isAuthenticated) return;

        const handleReset = () => {
            notifiedEventIds.current.clear();
            toast.dismiss(); // Clear visible warnings immediately
            checkSchedule(true);
        };
        window.addEventListener('guardian-reset', handleReset);

        // Run initial check almost immediately
        const timer = setTimeout(() => checkSchedule(), 2000);
        
        // Set up background heartbeat
        const interval = setInterval(() => checkSchedule(), 30000);
        
        return () => {
            window.removeEventListener('guardian-reset', handleReset);
            clearTimeout(timer);
            clearInterval(interval);
        };
    }, [isAuthenticated, checkSchedule]);

    return null;
}
