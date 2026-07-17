import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';

interface ChartProps {
  data: { time: string; rate: number }[];
}

export function ThroughputChart({ data }: ChartProps) {
  if (data.length === 0) {
    return (
      <div className="flex items-center justify-center text-tertiary mono" style={{ height: '100%' }}>
        Awaiting throughput data...
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height="100%">
      <AreaChart data={data} margin={{ top: 10, right: 0, left: -20, bottom: 0 }}>
        <defs>
          <linearGradient id="colorRate" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="var(--accent-blue)" stopOpacity={0.3}/>
            <stop offset="95%" stopColor="var(--accent-blue)" stopOpacity={0}/>
          </linearGradient>
        </defs>
        <XAxis 
          dataKey="time" 
          stroke="var(--border-strong)" 
          fontSize={10} 
          tickFormatter={() => ''} // Hide x-axis labels for minimalism
          axisLine={false} 
          tickLine={false} 
        />
        <YAxis 
          stroke="var(--border-strong)" 
          fontSize={10} 
          axisLine={false} 
          tickLine={false} 
          tickFormatter={(val) => val.toLocaleString()}
        />
        <Tooltip 
          contentStyle={{ backgroundColor: 'var(--bg-surface-hover)', borderColor: 'var(--border-strong)', borderRadius: 'var(--radius-sm)' }}
          itemStyle={{ color: 'var(--text-primary)', fontFamily: 'var(--font-mono)', fontSize: '12px' }}
          labelStyle={{ display: 'none' }}
          formatter={(value: any) => [`${value.toLocaleString()} exec/sec`, 'Throughput']}
        />
        <Area 
          type="monotone" 
          dataKey="rate" 
          stroke="var(--accent-blue)" 
          fillOpacity={1} 
          fill="url(#colorRate)" 
          isAnimationActive={false} // Disable recharts animation to prevent lag on constant updates
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}
