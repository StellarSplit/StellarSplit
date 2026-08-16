import { Check } from 'lucide-react';

interface Step {
    label: string;
}

interface StepIndicatorProps {
    steps: Step[];
    currentStep: number;
    onStepClick?: (stepIndex: number) => void;
}

export const StepIndicator = ({ steps, currentStep, onStepClick }: StepIndicatorProps) => {
    return (
        <nav aria-label="Split creation progress" className="w-full px-4 py-4">
            <ol className="flex items-center justify-between relative list-none m-0 p-0">
                {/* Connecting line */}
                <div className="absolute top-4 left-0 right-0 h-0.5 bg-gray-200 z-0" aria-hidden="true" />
                <div
                    className="absolute top-4 left-0 h-0.5 bg-purple-500 z-0 transition-all duration-500"
                    aria-hidden="true"
                    style={{
                        width: steps.length > 1
                            ? `${(currentStep / (steps.length - 1)) * 100}%`
                            : '0%',
                    }}
                />

                {steps.map((step, index) => {
                    const isCompleted = index < currentStep;
                    const isActive = index === currentStep;

                    const stepStateLabel = isActive
                        ? 'current step'
                        : isCompleted
                            ? 'completed'
                            : 'upcoming';

                    const stepAriaLabel = `Step ${index + 1} of ${steps.length}: ${step.label}, ${stepStateLabel}`;

                    const circleContent = (
                        <div
                            className={`w-8 h-8 rounded-full flex items-center justify-center border-2 transition-all duration-300 text-xs font-bold
                                ${isCompleted
                                    ? 'bg-purple-500 border-purple-500 text-white'
                                    : isActive
                                        ? 'bg-white border-purple-500 text-purple-600'
                                        : 'bg-white border-gray-300 text-gray-400'
                                }`}
                            aria-hidden="true"
                        >
                            {isCompleted ? <Check size={14} /> : index + 1}
                        </div>
                    );

                    const stepButton = isCompleted && onStepClick
                        ? (
                            <button
                                type="button"
                                onClick={() => onStepClick(index)}
                                className="flex flex-col items-center z-10 flex-1 bg-transparent border-none cursor-pointer p-0"
                                aria-label={`Go to step ${index + 1}: ${step.label}`}
                            >
                                {circleContent}
                            </button>
                        )
                        : (
                            <div className="flex flex-col items-center z-10 flex-1">
                                {circleContent}
                            </div>
                        );

                    const stepLabel = (
                        <span
                            className={`mt-1.5 text-[10px] font-medium text-center leading-tight hidden sm:block
                                ${isActive ? 'text-purple-600' : isCompleted ? 'text-gray-600' : 'text-gray-400'}`}
                        >
                            {step.label}
                        </span>
                    );

                    return (
                        <li
                            key={index}
                            aria-current={isActive ? 'step' : undefined}
                            aria-label={stepAriaLabel}
                            className="flex flex-col items-center flex-1"
                        >
                            {stepButton}
                            {stepLabel}
                        </li>
                    );
                })}
            </ol>
        </nav>
    );
};