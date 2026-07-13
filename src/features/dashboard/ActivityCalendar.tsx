import { Link } from 'react-router-dom';

export function ActivityCalendar({ activityByDate }: { activityByDate: Record<string, number> }) {
  const dates = Object.keys(activityByDate).sort();
  return <section aria-labelledby="activity-title">
    <h2 id="activity-title">练习日历</h2>
    {dates.length ? <div className="activity-calendar" role="list" aria-label="每日练习次数">
      {dates.map(date => {
        const count = activityByDate[date];
        const label = `${date}：${count} 次练习`;
        return <span key={date} role="listitem"><Link aria-label={label} title={label} to={`/problems?from=${date}&to=${date}`} style={{ '--activity': Math.min(count, 4) } as React.CSSProperties} /></span>;
      })}
    </div> : <p>还没有练习活动。</p>}
  </section>;
}
