import { Progress } from "../ui/progress";


export function ResourceGauge({ 
  title, 
  value, 
  color 
}: { 
  title: string; 
  value: number; 
  max: number; 
  color: string; 
}) {
  const colorMap = {
    blue: "bg-blue-500",
    purple: "bg-purple-500",
    green: "bg-green-500"
  };

  return (
    <div>
      <div className="flex justify-between mb-2">
        <span className="text-sm font-medium">{title}</span>
        <span className="text-sm font-bold">{value}%</span>
      </div>
      <Progress 
        value={value} 
        className={`${colorMap[color as keyof typeof colorMap]} h-3`} 
      />
    </div>
  );
}