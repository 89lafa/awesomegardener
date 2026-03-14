import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';
import { cn } from '@/lib/utils';

export default function BackButton({ className, label, to }) {
  const navigate = useNavigate();
  
  const handleClick = () => {
    if (to) {
      navigate(to);
    } else {
      navigate(-1);
    }
  };
  
  return (
    <Button
      variant="ghost"
      onClick={handleClick}
      className={cn("gap-2 h-10 px-3", className)}
    >
      <ArrowLeft className="w-5 h-5" />
      {label && <span className="hidden sm:inline">{label}</span>}
    </Button>
  );
}