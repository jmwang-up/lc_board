export function ActivityCalendar({ activityByDate }: { activityByDate: Record<string, number> }) {
  const dates = Object.keys(activityByDate).sort();
  return <section aria-labelledby="activity-title">
    <h2 id="activity-title">练习日历</h2>
    {dates.length ? <div className="activity-calendar" role="list" aria-label="每日练习次数">
      {dates.map(date => {
        const count = activityByDate[date];
        return <span key={date} role="listitem" aria-label={`${date}：${count} 次练习`} title={`${date}：${count} 次练习`} style={{ '--activity': Math.min(count, 4) } as React.CSSProperties} />;
      })}
    </div> : <p>还没有练习活动。</p>}
  </section>;
}
