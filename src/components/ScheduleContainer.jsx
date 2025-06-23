import React, { useEffect, useState } from "react";
import WeeklyMatchupsDisplay from "./WeeklyMatchupsDisplay";

export default function ScheduleContainer() {
  const [schedule, setSchedule] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetch(
      "https://script.google.com/macros/s/AKfycbzCdSKv-pJSyewZWljTIlyacgb3hBqwthsKGQjCRD6-zJaqX5lbFvMRFckEG-Kb_cMf/exec"
    )
      .then((res) => {
        if (!res.ok) throw new Error("Failed to fetch schedule data");
        return res.json();
      })
      .then((data) => {
        setSchedule(data);
        setLoading(false);
      })
      .catch((e) => {
        setError(e.message);
        setLoading(false);
      });
  }, []);

  if (loading) return <div>Loading schedule...</div>;
  if (error) return <div>Error: {error}</div>;
  if (!schedule.length) return <div>No schedule data found.</div>;

  return <WeeklyMatchupsDisplay schedule={schedule} />;
}
