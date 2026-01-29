// Using Recharts (install: npm install recharts)
import { ResourceChartData } from '@/types/inventory';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

export function ResourceChart({ data }: { data: ResourceChartData[] }) {
  return (
    <ResponsiveContainer width="100%" height={300}>
      <LineChart data={data}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis dataKey="date" />
        <YAxis domain={[0, 100]} />
        <Tooltip />
        <Line
          type="monotone"
          dataKey="cpu"
          stroke="#3b82f6"
          strokeWidth={2}
          name="CPU Usage (%)"
        />
        <Line
          type="monotone"
          dataKey="ram"
          stroke="#8b5cf6"
          strokeWidth={2}
          name="RAM Usage (%)"
        />
      </LineChart>
    </ResponsiveContainer>
  );
}