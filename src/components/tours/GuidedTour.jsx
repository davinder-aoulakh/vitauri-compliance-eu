import React, { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { X, ChevronRight, ChevronLeft, Check, MapPin } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";

export default function GuidedTour({ steps, onComplete, onSkip, tourKey }) {
  const [currentStep, setCurrentStep] = useState(0);
  const [isVisible, setIsVisible] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    // Check if tour has been completed before
    const completedTours = JSON.parse(localStorage.getItem("completedTours") || "[]");
    if (completedTours.includes(tourKey)) {
      setIsVisible(false);
    }
  }, [tourKey]);

  const handleNext = () => {
    if (currentStep < steps.length - 1) {
      setCurrentStep(currentStep + 1);
      const nextStep = steps[currentStep + 1];
      // Navigate to next page if specified after updating step
      if (nextStep.navigateTo) {
        setTimeout(() => {
          navigate(createPageUrl(nextStep.navigateTo));
        }, 300);
      }
    } else {
      handleComplete();
    }
  };

  const handlePrevious = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleComplete = () => {
    // Mark tour as completed
    const completedTours = JSON.parse(localStorage.getItem("completedTours") || "[]");
    if (!completedTours.includes(tourKey)) {
      completedTours.push(tourKey);
      localStorage.setItem("completedTours", JSON.stringify(completedTours));
    }
    setIsVisible(false);
    onComplete?.();
  };

  const handleSkip = () => {
    setIsVisible(false);
    onSkip?.();
  };

  if (!isVisible || !steps || steps.length === 0) return null;

  const step = steps[currentStep];
  const progress = ((currentStep + 1) / steps.length) * 100;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
        onClick={handleSkip}
      >
        <motion.div
          initial={{ scale: 0.9, y: 20 }}
          animate={{ scale: 1, y: 0 }}
          exit={{ scale: 0.9, y: 20 }}
          onClick={(e) => e.stopPropagation()}
          className="max-w-lg w-full"
        >
          <Card className="border-2 border-indigo-500 shadow-2xl">
            <CardContent className="p-6 space-y-4">
              {/* Header */}
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center">
                      <step.icon className="w-4 h-4 text-indigo-600" />
                    </div>
                    <h3 className="text-lg font-semibold text-slate-900">{step.title}</h3>
                  </div>
                  <p className="text-sm text-slate-600">{step.description}</p>
                </div>
                <button
                  onClick={handleSkip}
                  className="p-1 hover:bg-slate-100 rounded transition-colors"
                >
                  <X className="w-4 h-4 text-slate-400" />
                </button>
              </div>

              {/* Content */}
              {step.content && (
                <div className="p-4 bg-slate-50 rounded-lg border border-slate-200">
                  {typeof step.content === "string" ? (
                    <p className="text-sm text-slate-700">{step.content}</p>
                  ) : (
                    step.content
                  )}
                </div>
              )}

              {/* Navigation indicator for multi-page tours */}
              {step.navigateTo && (
                <div className="flex items-center gap-2 text-xs text-indigo-600 bg-indigo-50 px-3 py-2 rounded-lg">
                  <MapPin className="w-3 h-3" />
                  <span>Next step will navigate to: <strong>{step.navigateTo}</strong></span>
                </div>
              )}

              {/* Progress Bar */}
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs text-slate-600">
                  <span>Step {currentStep + 1} of {steps.length}</span>
                  <span>{Math.round(progress)}% Complete</span>
                </div>
                <div className="w-full bg-slate-200 rounded-full h-2">
                  <motion.div
                    className="bg-indigo-600 h-2 rounded-full"
                    initial={{ width: 0 }}
                    animate={{ width: `${progress}%` }}
                    transition={{ duration: 0.3 }}
                  />
                </div>
              </div>

              {/* Actions */}
              <div className="flex items-center justify-between pt-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleSkip}
                  className="text-slate-600"
                >
                  Skip Tour
                </Button>
                <div className="flex gap-2">
                  {currentStep > 0 && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handlePrevious}
                      className="gap-1"
                    >
                      <ChevronLeft className="w-4 h-4" />
                      Previous
                    </Button>
                  )}
                  <Button
                    size="sm"
                    onClick={handleNext}
                    className="gap-1 bg-indigo-600 hover:bg-indigo-700"
                  >
                    {currentStep === steps.length - 1 ? (
                      <>
                        <Check className="w-4 h-4" />
                        Finish
                      </>
                    ) : (
                      <>
                        Next
                        <ChevronRight className="w-4 h-4" />
                      </>
                    )}
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}