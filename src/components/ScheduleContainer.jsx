// src/components/ScheduleContainer.jsx
import React, { useEffect, useState } from "react";
import WeeklyMatchupsDisplay from "./WeeklyMatchupsDisplay";

export default function ScheduleContainer() {
  const [schedule, setSchedule] = useState([]);
  const [historicalData, setHistoricalData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchData() {
      try {
        // Fetch schedule from your Google Apps Script URL
        const scheduleRes = await fetch(
          "https://script.google.com/macros/s/AKfycbzCdSKv-pJSyewZWljTIlyacgb3hBqwthsKGQjCRD6-zJaqX5lbFvMRFckEG-Kb_cMf/exec"
        );
        const scheduleJson = await scheduleRes.json();

        // Here you should fetch your historical matchup data (e.g. from your API or sheet)
        // For now, I'll simulate with an empty object — replace with your real fetch!
        const historicalRes = await fetch("/api/historicalData"); // Replace with your real URL
        const historicalJson = await historicalRes.json();

        setSchedule(scheduleJson);
        setHistoricalData(historicalJson);
        setLoading(false);
      } catch (error) {
        console.error("Failed to load data", error);
        setLoading(false);
      }
    }

    fetchData();
  }, []);

  if (loading) return <div>Loading schedule...</div>;
  if (!schedule.length) return <div>No schedule data found.</div>;

  return <WeeklyMatchupsDisplay schedule={schedule} historicalData={historicalData} />;
}
