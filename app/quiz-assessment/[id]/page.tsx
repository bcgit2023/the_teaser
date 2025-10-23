import QuizAssessmentClient from '@/components/quiz-assessment-client'

export default function QuizAssessmentPage({ params }: { params: { id: string } }) {
  return <QuizAssessmentClient id={params.id} />
}