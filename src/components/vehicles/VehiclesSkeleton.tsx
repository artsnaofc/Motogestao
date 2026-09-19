import React from 'react';
import { Bike } from 'lucide-react';

export const VehiclesSkeleton: React.FC = () => {
  return (
    <div className="space-y-6 pb-12 animate-pulse">
      {/* Fleet Grid Skeleton */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {[1, 2].map((i) => (
          <div key={i} className="bg-card/80 border border-border/60 rounded-3xl p-5 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="h-12 w-12 rounded-2xl bg-muted/60" />
                <div className="space-y-2">
                  <div className="h-4 w-36 bg-muted/70 rounded-md" />
                  <div className="h-3 w-24 bg-muted/50 rounded-md" />
                </div>
              </div>
              <div className="h-6 w-16 bg-muted/50 rounded-full" />
            </div>

            {/* Metrics grid skeleton */}
            <div className="grid grid-cols-4 gap-2.5 p-3 bg-muted/30 border border-border/40 rounded-2xl">
              {[1, 2, 3, 4].map((j) => (
                <div key={j} className="space-y-1.5">
                  <div className="h-2.5 w-12 bg-muted/60 rounded-sm" />
                  <div className="h-4 w-16 bg-muted/80 rounded-md" />
                </div>
              ))}
            </div>

            {/* Actions skeleton */}
            <div className="pt-2 border-t border-border/40 flex gap-2">
              <div className="flex-1 h-9 bg-muted/50 rounded-xl" />
              <div className="flex-1 h-9 bg-muted/70 rounded-xl" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
