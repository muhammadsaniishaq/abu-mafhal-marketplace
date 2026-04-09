import React from 'react';

export function Skeleton({ className, ...props }) {
    return (
        <div
            className={`animate-pulse rounded-md bg-slate-200/60 ${className}`}
            {...props}
        />
    );
}

export function CardSkeleton() {
    return (
        <div className="bg-white rounded-2xl p-6 border border-slate-100 shadow-sm space-y-4">
            <div className="flex items-center justify-between">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-8 w-8 rounded-lg" />
            </div>
            <div className="space-y-2">
                <Skeleton className="h-8 w-32" />
                <Skeleton className="h-4 w-48" />
            </div>
        </div>
    );
}
