// src/app/requests/components/RequestStepper.tsx
"use client";

import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

interface Step {
  id: number;
  title: string;
  description: string;
}

const steps: Step[] = [
  { id: 0, title: "Type", description: "Request Type" },
  { id: 1, title: "Identity", description: "System & Project" },
  { id: 2, title: "Compute", description: "Resource Allocation" },
  { id: 3, title: "Network", description: "Access & Security" },
  { id: 4, title: "Finalize", description: "Documents & Submit" },
];

export function RequestStepper({ 
  currentStep, 
  onStepClick,
  isEditOrCopy = false
}: { 
  currentStep: number;
  onStepClick?: (stepId: number) => void;
  isEditOrCopy?: boolean;
}) {
  const stepsToRender = isEditOrCopy ? steps.slice(1) : steps;
  
  // Calculate progress bar percentage based on active flow
  let progressPercent = 0;
  if (isEditOrCopy) {
    progressPercent = Math.max(0, Math.min(100, ((currentStep - 1) / 3) * 100));
  } else {
    progressPercent = Math.max(0, Math.min(100, (currentStep / 4) * 100));
  }
  
  return (
    <div className="w-full py-6 px-2">
      <div className="relative flex justify-between">
        {/* Progress Bar Background */}
        <div className="absolute top-5 left-0 w-full h-0.5 bg-slate-200 -z-10" />
        
        {/* Active Progress Bar */}
        <div 
          className="absolute top-5 left-0 h-0.5 bg-blue-600 transition-all duration-500 ease-in-out -z-10" 
          style={{ width: `${progressPercent}%` }}
        />

        {stepsToRender.map((step) => {
          const isCompleted = currentStep > step.id;
          const isActive = currentStep === step.id;
          
          // Click is allowed for completed/active steps, and never for step 0 in edit/copy mode
          const isClickable = onStepClick && step.id <= currentStep && !(isEditOrCopy && step.id === 0);

          return (
            <div 
              key={step.id} 
              className={cn(
                "flex flex-col items-center select-none",
                isClickable ? "cursor-pointer group" : "cursor-not-allowed opacity-60"
              )}
              onClick={() => isClickable && onStepClick?.(step.id)}
            >
              <div
                className={cn(
                  "w-10 h-10 rounded-full flex items-center justify-center border-2 transition-all duration-300 shadow-sm",
                  isCompleted
                    ? "bg-blue-600 border-blue-600 text-white"
                    : isActive
                    ? "bg-white border-blue-600 text-blue-600 ring-4 ring-blue-50"
                    : "bg-white border-slate-300 text-slate-400",
                  isClickable && !isActive && "group-hover:border-blue-400 group-hover:text-blue-400"
                )}
              >
                {isCompleted ? (
                  <Check className="w-5 h-5 stroke-[3px]" />
                ) : (
                  <span className="font-bold text-sm">{step.id === 0 ? "T" : step.id}</span>
                )}
              </div>
              <div className="mt-3 text-center">
                <p className={cn(
                  "text-[11px] font-bold uppercase tracking-wider",
                  isActive ? "text-blue-600" : "text-slate-500",
                  isClickable && !isActive && "group-hover:text-blue-400"
                )}>
                  {step.title}
                </p>
                <p className="hidden md:block text-[10px] text-slate-400 mt-0.5 font-medium">
                  {step.description}
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
export default RequestStepper;
