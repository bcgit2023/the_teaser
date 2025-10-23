import React from 'react';
import {
  Chart as ChartJS,
  RadialLinearScale,
  PointElement,
  LineElement,
  Filler,
  Tooltip,
  Legend,
} from 'chart.js';
import { Radar } from 'react-chartjs-2';

ChartJS.register(
  RadialLinearScale,
  PointElement,
  LineElement,
  Filler,
  Tooltip,
  Legend
);

export interface PerformanceData {
  accuracy: number;
  speed: number;
  confidence: number;
  consistency: number;
  categoryMastery: number;
}

interface RadarChartProps {
  grammarData: PerformanceData;
  pastTenseData: PerformanceData;
  futureTenseData: PerformanceData;
  vocabularyData: PerformanceData;
}

export function RadarChart({
  grammarData,
  pastTenseData,
  futureTenseData,
  vocabularyData,
}: RadarChartProps) {
  const data = {
    labels: ['Accuracy', 'Speed', 'Confidence', 'Consistency', 'Category Mastery'],
    datasets: [
      {
        label: 'Grammar',
        data: [
          grammarData.accuracy,
          grammarData.speed,
          grammarData.confidence,
          grammarData.consistency,
          grammarData.categoryMastery,
        ],
        backgroundColor: 'rgba(99, 102, 241, 0.15)',
        borderColor: 'rgba(99, 102, 241, 0.8)',
        borderWidth: 2,
        pointBackgroundColor: 'rgba(99, 102, 241, 1)',
        pointBorderColor: '#fff',
        pointHoverBackgroundColor: '#fff',
        pointHoverBorderColor: 'rgba(99, 102, 241, 1)',
        pointRadius: 4,
        pointHoverRadius: 6,
      },
      {
        label: 'Past Tense',
        data: [
          pastTenseData.accuracy,
          pastTenseData.speed,
          pastTenseData.confidence,
          pastTenseData.consistency,
          pastTenseData.categoryMastery,
        ],
        backgroundColor: 'rgba(244, 63, 94, 0.15)',
        borderColor: 'rgba(244, 63, 94, 0.8)',
        borderWidth: 2,
        pointBackgroundColor: 'rgba(244, 63, 94, 1)',
        pointBorderColor: '#fff',
        pointHoverBackgroundColor: '#fff',
        pointHoverBorderColor: 'rgba(244, 63, 94, 1)',
        pointRadius: 4,
        pointHoverRadius: 6,
      },
      {
        label: 'Future Tense',
        data: [
          futureTenseData.accuracy,
          futureTenseData.speed,
          futureTenseData.confidence,
          futureTenseData.consistency,
          futureTenseData.categoryMastery,
        ],
        backgroundColor: 'rgba(34, 197, 94, 0.15)',
        borderColor: 'rgba(34, 197, 94, 0.8)',
        borderWidth: 2,
        pointBackgroundColor: 'rgba(34, 197, 94, 1)',
        pointBorderColor: '#fff',
        pointHoverBackgroundColor: '#fff',
        pointHoverBorderColor: 'rgba(34, 197, 94, 1)',
        pointRadius: 4,
        pointHoverRadius: 6,
      },
      {
        label: 'Vocabulary',
        data: [
          vocabularyData.accuracy,
          vocabularyData.speed,
          vocabularyData.confidence,
          vocabularyData.consistency,
          vocabularyData.categoryMastery,
        ],
        backgroundColor: 'rgba(234, 179, 8, 0.15)',
        borderColor: 'rgba(234, 179, 8, 0.8)',
        borderWidth: 2,
        pointBackgroundColor: 'rgba(234, 179, 8, 1)',
        pointBorderColor: '#fff',
        pointHoverBackgroundColor: '#fff',
        pointHoverBorderColor: 'rgba(234, 179, 8, 1)',
        pointRadius: 4,
        pointHoverRadius: 6,
      },
    ],
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    scales: {
      r: {
        min: 0,
        max: 100,
        beginAtZero: true,
        backgroundColor: 'rgba(247, 248, 250, 0.8)',
        grid: {
          color: 'rgba(0, 0, 0, 0.1)',
        },
        angleLines: {
          color: 'rgba(0, 0, 0, 0.1)',
        },
        pointLabels: {
          font: {
            size: 14,
            family: "'Inter', sans-serif",
            weight: 600,
          },
          color: 'rgba(0, 0, 0, 0.7)',
          padding: 20,
        },
        ticks: {
          stepSize: 20,
          backdropColor: 'transparent',
          color: 'rgba(0, 0, 0, 0.5)',
          font: {
            size: 10,
          },
        },
      },
    },
    plugins: {
      legend: {
        position: 'top' as const,
        align: 'center' as const,
        labels: {
          usePointStyle: true,
          pointStyle: 'circle',
          padding: 20,
          font: {
            size: 12,
            family: "'Inter', sans-serif",
            weight: 500,
          },
        },
      },
      tooltip: {
        backgroundColor: 'rgba(255, 255, 255, 0.95)',
        titleColor: '#000',
        titleFont: {
          size: 14,
          weight: 600,
          family: "'Inter', sans-serif",
        },
        bodyColor: '#666',
        bodyFont: {
          size: 12,
          family: "'Inter', sans-serif",
        },
        padding: 12,
        boxPadding: 6,
        borderColor: 'rgba(0, 0, 0, 0.1)',
        borderWidth: 1,
        callbacks: {
          label: function(context: any) {
            const label = context.dataset.label || '';
            const value = context.raw || 0;
            const metric = data.labels[context.dataIndex];
            return `${label} - ${metric}: ${value}${metric === 'Speed' ? 's' : '%'}`;
          },
        },
      },
    },
    elements: {
      line: {
        tension: 0.4,
      },
    },
  };

  return (
    <div className="w-full h-[500px] p-4 bg-white rounded-lg shadow-sm">
      <Radar data={data} options={options} />
    </div>
  );
}
