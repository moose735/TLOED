// src/components/ScheduleContainer.jsx
import React, { useEffect, useState } from "react";
import WeeklyMatchupsDisplay from "./WeeklyMatchupsDisplay";

export default function ScheduleContainer() {
  const [schedule, setSchedule] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchSchedule() {
      try {
        const res = await fetch(
          "https://script.google.com/macros/s/AKfycbzCdSKv-pJSyewZWljTIlyacgb3hBqwthsKGQjCRD6-zJaqX5lbFvMRFckEG-Kb_cMf/exec"
        );
        const json = await res.json();
        setSchedule(json);
      } catch (error) {
        console.error("Failed to fetch schedule", error);
      } finally {
        setLoading(false);
      }
    }

    fetchSchedule();
  }, []);

  if (loading) return <div>Loading schedule...</div>;
  if (!schedule.length) return <div>No schedule data found.</div>;

  // Pass only schedule, no historicalData
  return <WeeklyMatchupsDisplay schedule={schedule} />;
}
