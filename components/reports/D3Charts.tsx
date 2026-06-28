import React, { useEffect, useRef, useState } from 'react';
import * as d3 from 'd3';

// Helper for formatting currency
const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
        style: 'currency',
        currency: 'BRL'
    }).format(value);
};

interface RevenueData {
    name: string; // "dd/MM"
    valor: number;
}

export const D3RevenueEvolutionChart: React.FC<{ data: RevenueData[] }> = ({ data }) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const svgRef = useRef<SVGSVGElement>(null);
    const [dimensions, setDimensions] = useState({ width: 500, height: 320 });
    const [tooltip, setTooltip] = useState<{ x: number; y: number; visible: boolean; title: string; value: string } | null>(null);

    // Track dimensions
    useEffect(() => {
        if (!containerRef.current) return;
        const resizeObserver = new ResizeObserver((entries) => {
            if (!entries || entries.length === 0) return;
            const { width, height } = entries[0].contentRect;
            setDimensions({
                width: Math.max(width, 200),
                height: Math.max(height || 320, 200)
            });
        });
        resizeObserver.observe(containerRef.current);
        return () => resizeObserver.disconnect();
    }, []);

    useEffect(() => {
        if (!svgRef.current || !data || data.length === 0) return;

        const { width, height } = dimensions;
        const margin = { top: 20, right: 30, bottom: 45, left: 60 };
        const chartWidth = width - margin.left - margin.right;
        const chartHeight = height - margin.top - margin.bottom;

        // Clear existing svg elements
        const svg = d3.select(svgRef.current);
        svg.selectAll('*').remove();

        // Create main container group
        const g = svg.append('g')
            .attr('transform', `translate(${margin.left}, ${margin.top})`);

        // Scales
        const xScale = d3.scalePoint<string>()
            .domain(data.map(d => d.name))
            .range([0, chartWidth]);

        const yMax = d3.max(data, d => d.valor) || 100;
        const yScale = d3.scaleLinear()
            .domain([0, yMax * 1.1]) // Add 10% padding on top
            .range([chartHeight, 0]);

        // Gradients
        const defs = svg.append('defs');
        
        const areaGradient = defs.append('linearGradient')
            .attr('id', 'd3-area-gradient')
            .attr('x1', '0%')
            .attr('y1', '0%')
            .attr('x2', '0%')
            .attr('y2', '100%');

        areaGradient.append('stop')
            .attr('offset', '0%')
            .attr('stop-color', '#f97316') // Orange-500
            .attr('stop-opacity', 0.25);

        areaGradient.append('stop')
            .attr('offset', '100%')
            .attr('stop-color', '#f97316')
            .attr('stop-opacity', 0);

        const lineGradient = defs.append('linearGradient')
            .attr('id', 'd3-line-gradient')
            .attr('x1', '0%')
            .attr('y1', '0%')
            .attr('x2', '100%')
            .attr('y2', '0%');

        lineGradient.append('stop')
            .attr('offset', '0%')
            .attr('stop-color', '#ea580c'); // Orange-600

        lineGradient.append('stop')
            .attr('offset', '100%')
            .attr('stop-color', '#f97316'); // Orange-500

        // Grid lines
        const yGrid = d3.axisLeft(yScale)
            .ticks(5)
            .tickSize(-chartWidth)
            .tickFormat(() => '');

        g.append('g')
            .attr('class', 'grid')
            .call(yGrid)
            .call(g => g.select('.domain').remove())
            .selectAll('.tick line')
            .attr('stroke', '#e2e8f0')
            .attr('stroke-dasharray', '4,4');

        // Draw Area
        const areaGenerator = d3.area<RevenueData>()
            .x(d => xScale(d.name) || 0)
            .y0(chartHeight)
            .y1(d => yScale(d.valor))
            .curve(d3.curveMonotoneX);

        g.append('path')
            .datum(data)
            .attr('class', 'area')
            .attr('d', areaGenerator)
            .attr('fill', 'url(#d3-area-gradient)');

        // Draw Line
        const lineGenerator = d3.line<RevenueData>()
            .x(d => xScale(d.name) || 0)
            .y(d => yScale(d.valor))
            .curve(d3.curveMonotoneX);

        const path = g.append('path')
            .datum(data)
            .attr('fill', 'none')
            .attr('stroke', 'url(#d3-line-gradient)')
            .attr('stroke-width', 3.5)
            .attr('d', lineGenerator);

        // Line drawing animation
        const totalLength = (path.node() as SVGPathElement).getTotalLength();
        path.attr('stroke-dasharray', `${totalLength} ${totalLength}`)
            .attr('stroke-dashoffset', totalLength)
            .transition()
            .duration(800)
            .ease(d3.easeCubicOut)
            .attr('stroke-dashoffset', 0);

        // X Axis
        const xAxis = d3.axisBottom(xScale)
            .tickValues(data.filter((_, i) => {
                // Determine tick intervals depending on data length
                if (data.length <= 10) return true;
                if (data.length <= 20) return i % 2 === 0;
                return i % 5 === 0;
            }).map(d => d.name));

        g.append('g')
            .attr('transform', `translate(0, ${chartHeight})`)
            .attr('class', 'x-axis')
            .call(xAxis)
            .call(g => g.select('.domain').remove())
            .call(g => g.selectAll('.tick line').remove())
            .selectAll('text')
            .attr('fill', '#94a3b8')
            .attr('font-size', '10px')
            .attr('font-weight', '700')
            .attr('dy', '1em');

        // Y Axis
        const yAxis = d3.axisLeft(yScale)
            .ticks(5)
            .tickFormat(d => `R$ ${d3.format('.0f')(d as number)}`);

        g.append('g')
            .attr('class', 'y-axis')
            .call(yAxis)
            .call(g => g.select('.domain').remove())
            .call(g => g.selectAll('.tick line').remove())
            .selectAll('text')
            .attr('fill', '#94a3b8')
            .attr('font-size', '10px')
            .attr('font-weight', '700')
            .attr('dx', '-0.5em');

        // Interactive Focus elements
        const focusLine = g.append('line')
            .attr('stroke', '#cbd5e1')
            .attr('stroke-width', 1)
            .attr('stroke-dasharray', '3,3')
            .attr('y1', 0)
            .attr('y2', chartHeight)
            .style('display', 'none');

        const focusCircle = g.append('circle')
            .attr('r', 6)
            .attr('fill', '#ea580c')
            .attr('stroke', '#ffffff')
            .attr('stroke-width', 2)
            .style('display', 'none')
            .style('filter', 'drop-shadow(0px 2px 4px rgba(0, 0, 0, 0.15))');

        // Mouse overlay for interaction
        g.append('rect')
            .attr('width', chartWidth)
            .attr('height', chartHeight)
            .attr('fill', 'transparent')
            .style('cursor', 'crosshair')
            .on('mousemove', (event) => {
                const [mouseX] = d3.pointer(event);
                
                // Find nearest data point
                const names = data.map(d => d.name);
                const positions = names.map(name => xScale(name) || 0);
                
                let nearestIndex = 0;
                let minDiff = Infinity;
                positions.forEach((pos, idx) => {
                    const diff = Math.abs(pos - mouseX);
                    if (diff < minDiff) {
                        minDiff = diff;
                        nearestIndex = idx;
                    }
                });

                const d = data[nearestIndex];
                const xPos = xScale(d.name) || 0;
                const yPos = yScale(d.valor);

                focusLine
                    .attr('x1', xPos)
                    .attr('x2', xPos)
                    .style('display', null);

                focusCircle
                    .attr('cx', xPos)
                    .attr('cy', yPos)
                    .style('display', null);

                // Tooltip location inside component wrapper
                const rect = containerRef.current?.getBoundingClientRect();
                if (rect) {
                    setTooltip({
                        x: xPos + margin.left,
                        y: yPos + margin.top,
                        visible: true,
                        title: `Dia ${d.name}`,
                        value: formatCurrency(d.valor)
                    });
                }
            })
            .on('mouseleave', () => {
                focusLine.style('display', 'none');
                focusCircle.style('display', 'none');
                setTooltip(prev => prev ? { ...prev, visible: false } : null);
            });

    }, [data, dimensions]);

    return (
        <div ref={containerRef} className="w-full h-full relative">
            <svg ref={svgRef} className="w-full h-full overflow-visible" />
            
            {tooltip && tooltip.visible && (
                <div 
                    className="absolute z-30 pointer-events-none bg-slate-900 text-white rounded-xl p-3 shadow-xl border border-slate-800 text-xs transition-all duration-75 flex flex-col gap-0.5"
                    style={{ 
                        left: `${tooltip.x}px`, 
                        top: `${tooltip.y - 60}px`, 
                        transform: 'translateX(-50%)' 
                    }}
                >
                    <span className="font-bold text-slate-400 uppercase tracking-widest text-[9px]">{tooltip.title}</span>
                    <span className="font-black text-[13px] text-orange-400">{tooltip.value}</span>
                </div>
            )}
        </div>
    );
};

interface TeamPerformanceData {
    id: string;
    name: string;
    revenue: number;
    count: number;
    ticket: number;
    commission: number;
}

export const D3TeamPerformanceChart: React.FC<{ data: TeamPerformanceData[] }> = ({ data }) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const svgRef = useRef<SVGSVGElement>(null);
    const [dimensions, setDimensions] = useState({ width: 500, height: 350 });
    const [tooltip, setTooltip] = useState<{ x: number; y: number; visible: boolean; name: string; revenue: string; count: number; ticket: string } | null>(null);

    // Track dimensions
    useEffect(() => {
        if (!containerRef.current) return;
        const resizeObserver = new ResizeObserver((entries) => {
            if (!entries || entries.length === 0) return;
            const { width, height } = entries[0].contentRect;
            setDimensions({
                width: Math.max(width, 200),
                height: Math.max(height || 350, 200)
            });
        });
        resizeObserver.observe(containerRef.current);
        return () => resizeObserver.disconnect();
    }, []);

    useEffect(() => {
        if (!svgRef.current || !data || data.length === 0) return;

        const { width, height } = dimensions;
        const margin = { top: 30, right: 30, bottom: 50, left: 100 };
        const chartWidth = width - margin.left - margin.right;
        const chartHeight = height - margin.top - margin.bottom;

        // Clear existing svg elements
        const svg = d3.select(svgRef.current);
        svg.selectAll('*').remove();

        const g = svg.append('g')
            .attr('transform', `translate(${margin.left}, ${margin.top})`);

        // Scales
        const yScale = d3.scaleBand()
            .domain(data.map(d => d.name))
            .range([0, chartHeight])
            .padding(0.25);

        const xMax = d3.max(data, d => d.revenue) || 100;
        const xScale = d3.scaleLinear()
            .domain([0, xMax * 1.15]) // 15% padding at end of x-axis
            .range([0, chartWidth]);

        // Gradients for bars
        const defs = svg.append('defs');
        const barGradient = defs.append('linearGradient')
            .attr('id', 'd3-bar-gradient')
            .attr('x1', '0%')
            .attr('y1', '0%')
            .attr('x2', '100%')
            .attr('y2', '0%');

        barGradient.append('stop')
            .attr('offset', '0%')
            .attr('stop-color', '#4f46e5'); // Indigo-600

        barGradient.append('stop')
            .attr('offset', '100%')
            .attr('stop-color', '#818cf8'); // Indigo-400

        // Grid lines (vertical)
        const xGrid = d3.axisBottom(xScale)
            .ticks(5)
            .tickSize(-chartHeight)
            .tickFormat(() => '');

        g.append('g')
            .attr('transform', `translate(0, ${chartHeight})`)
            .attr('class', 'grid')
            .call(xGrid)
            .call(g => g.select('.domain').remove())
            .selectAll('.tick line')
            .attr('stroke', '#e2e8f0')
            .attr('stroke-dasharray', '4,4');

        // Draw Bars
        const barGroup = g.selectAll('.bar-group')
            .data(data)
            .enter()
            .append('g')
            .attr('class', 'bar-group');

        const bars = barGroup.append('rect')
            .attr('y', d => yScale(d.name) || 0)
            .attr('x', 0)
            .attr('height', yScale.bandwidth())
            .attr('fill', 'url(#d3-bar-gradient)')
            .attr('rx', 8) // rounded corners
            .attr('width', 0) // start at 0 for entrance animation
            .style('cursor', 'pointer');

        // Entrance animation
        bars.transition()
            .duration(800)
            .ease(d3.easeCubicOut)
            .attr('width', d => xScale(d.revenue));

        // Add revenue values on top/inside of bars
        barGroup.append('text')
            .attr('y', d => (yScale(d.name) || 0) + yScale.bandwidth() / 2)
            .attr('x', d => xScale(d.revenue) + 8)
            .attr('dy', '0.35em')
            .attr('fill', '#475569')
            .attr('font-size', '10px')
            .attr('font-weight', '800')
            .text(d => formatCurrency(d.revenue))
            .style('opacity', 0)
            .transition()
            .delay(400)
            .duration(400)
            .style('opacity', 1);

        // Interaction (Hover)
        bars.on('mouseover', function(event, d) {
            d3.select(this)
                .transition()
                .duration(150)
                .attr('fill', '#6366f1'); // Lighter indigo

            const rect = containerRef.current?.getBoundingClientRect();
            if (rect) {
                // Find screen positioning
                const barY = yScale(d.name) || 0;
                const barHeight = yScale.bandwidth();
                setTooltip({
                    x: xScale(d.revenue) + margin.left,
                    y: barY + barHeight / 2 + margin.top,
                    visible: true,
                    name: d.name,
                    revenue: formatCurrency(d.revenue),
                    count: d.count,
                    ticket: formatCurrency(d.ticket)
                });
            }
        })
        .on('mouseleave', function() {
            d3.select(this)
                .transition()
                .duration(150)
                .attr('fill', 'url(#d3-bar-gradient)');

            setTooltip(prev => prev ? { ...prev, visible: false } : null);
        });

        // X Axis
        const xAxis = d3.axisBottom(xScale)
            .ticks(5)
            .tickFormat(d => `R$ ${d3.format('.0f')(d as number)}`);

        g.append('g')
            .attr('transform', `translate(0, ${chartHeight})`)
            .attr('class', 'x-axis')
            .call(xAxis)
            .call(g => g.select('.domain').remove())
            .call(g => g.selectAll('.tick line').remove())
            .selectAll('text')
            .attr('fill', '#94a3b8')
            .attr('font-size', '10px')
            .attr('font-weight', '700')
            .attr('dy', '1em');

        // Y Axis (Names)
        const yAxis = d3.axisLeft(yScale);

        g.append('g')
            .attr('class', 'y-axis')
            .call(yAxis)
            .call(g => g.select('.domain').remove())
            .call(g => g.selectAll('.tick line').remove())
            .selectAll('text')
            .attr('fill', '#1e293b') // darker text for readability
            .attr('font-size', '11px')
            .attr('font-weight', '800')
            .style('text-anchor', 'end');

    }, [data, dimensions]);

    return (
        <div ref={containerRef} className="w-full h-full relative">
            <svg ref={svgRef} className="w-full h-full overflow-visible" />
            
            {tooltip && tooltip.visible && (
                <div 
                    className="absolute z-30 pointer-events-none bg-slate-900 text-white rounded-2xl p-4 shadow-2xl border border-slate-800 text-xs flex flex-col gap-1.5 transition-all duration-75"
                    style={{ 
                        left: `${tooltip.x + 15}px`, 
                        top: `${tooltip.y - 50}px`
                    }}
                >
                    <span className="font-extrabold text-slate-200 text-sm border-b border-slate-700/50 pb-1 mb-1">{tooltip.name}</span>
                    <div className="flex flex-col gap-0.5">
                        <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Faturamento</span>
                        <span className="font-black text-emerald-400 text-sm">{tooltip.revenue}</span>
                    </div>
                    <div className="grid grid-cols-2 gap-3 mt-1 pt-1 border-t border-slate-800">
                        <div className="flex flex-col">
                            <span className="text-[9px] text-slate-400 font-bold uppercase tracking-wider">Visitas</span>
                            <span className="font-black text-slate-200">{tooltip.count}</span>
                        </div>
                        <div className="flex flex-col">
                            <span className="text-[9px] text-slate-400 font-bold uppercase tracking-wider">Tkt Médio</span>
                            <span className="font-black text-indigo-400">{tooltip.ticket}</span>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
