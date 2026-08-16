import { Check } from 'lucide-react';

interface Step {
    label: string;
}

interface StepIndicatorProps {
    steps: Step[];
    currentStep: number;
    prefersReducedMotion?: boolean;
}

export const StepIndicator = ({ steps, currentStep, prefersReducedMotion = false }: StepIndicatorProps) => {
    return (
        <div className="w-full px-4 py-4">
            <div className="flex items-center justify-between relative">
                {/* Connecting line */}
                <div className="absolute top-4 left-0 right-0 h-0.5 bg-gray-200 z-0" />
                <div
                    className={`absolute top-4 left-0 h-0.5 bg-purple-500 z-0 ${prefersReducedMotion ? '' : 'transition-all duration-500'}`}
                    style={{
                        width: steps.length > 1
                            ? `${(currentStep / (steps.length - 1)) * 100}%`
                            : '0%',
                    }}
                />

                {steps.map((step, index) => {
                    const isCompleted = index < currentStep;
                    const isActive = index === currentStep;

                    return (
                        <div key={index} className="flex flex-col items-center z-10 flex-1">
                            <div
                                className={`w-8 h-8 rounded-full flex items-center justify-center border-2 text-xs font-bold ${prefersReducedMotion ? '' : 'transition-all duration-300'}
                                    ${isCompleted
                                        ? 'bg-purple-500 border-purple-500 text-white'
                                        : isActive
                                            ? 'bg-white border-purple-500 text-purple-600'
                                            : 'bg-white border-gray-300 text-gray-400'
                                    }`}
                            >
                                {isCompleted ? <Check size={14} /> : index + 1}
                            </div>
                            <span
                                className={`mt-1.5 text-[10px] font-medium text-center leading-tight hidden sm:block
                                    ${isActive ? 'text-purple-600' : isCompleted ? 'text-gray-600' : 'text-gray-400'}`}
                            >
                                {step.label}
                            </span>
                        </div>
                    );
                })}
            </div>
        </div>
    );
};