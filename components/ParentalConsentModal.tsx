'use client'

import { useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Label } from '@/components/ui/label'
import { ScrollArea } from '@/components/ui/scroll-area'
import { CheckCircle, XCircle } from 'lucide-react'

interface ParentalConsentModalProps {
  isOpen: boolean
  onClose: () => void
  onConsent: (granted: boolean) => void
}

export default function ParentalConsentModal({
  isOpen,
  onClose,
  onConsent,
}: ParentalConsentModalProps) {
  const [consentChoice, setConsentChoice] = useState<string>('')

  const handleSubmit = () => {
    console.log('Submit clicked with choice:', consentChoice)
    if (consentChoice === 'grant') {
      console.log('Calling onConsent(true)')
      onConsent(true)
    } else if (consentChoice === 'deny') {
      console.log('Calling onConsent(false)')
      onConsent(false)
    }
    onClose()
  }

  const handleClose = () => {
    setConsentChoice('')
    onClose()
  }

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] p-0 flex flex-col">
        <DialogHeader className="p-6 pb-4 flex-shrink-0">
          <DialogTitle className="text-2xl font-bold text-center text-red-600">
            PARENTAL AUTHORIZATION FOR VIDEO RECORDING
          </DialogTitle>
        </DialogHeader>
        
        <ScrollArea className="flex-1 px-6 border border-gray-200 mx-6 rounded-md">
          <div className="space-y-6 text-sm leading-relaxed py-4">
            {/* Important Notice */}
            <section>
              <h3 className="text-lg font-bold text-red-600 mb-3">
                IMPORTANT NOTICE FOR PARENTS/LEGAL GUARDIANS
              </h3>
              <p className="text-gray-700">
                Before your child can be recorded, we are required by law to obtain your explicit consent. 
                This website records children's learning activities and shares this content publicly. 
                Please read the following information carefully.
              </p>
            </section>

            {/* What We Are Asking Permission For */}
            <section>
              <h3 className="text-lg font-bold text-blue-600 mb-3">
                WHAT WE ARE ASKING PERMISSION FOR:
              </h3>
              <p className="mb-2">We request your authorization to record your child's learning activities, including but not limited to:</p>
              <ul className="list-disc list-inside space-y-1 ml-4 text-gray-700">
                <li>Video recording of your child's voice, image, and learning activities</li>
                <li>Audio recording of your child's voice and participation</li>
                <li>Screen capture of your child's digital learning activities</li>
                <li>Still photographs taken during learning sessions</li>
              </ul>
            </section>

            {/* Purpose of Recording */}
            <section>
              <h3 className="text-lg font-bold text-blue-600 mb-3">
                PURPOSE OF RECORDING:
              </h3>
              <p className="mb-2">The recordings will be used to:</p>
              <ul className="list-disc list-inside space-y-1 ml-4 text-gray-700">
                <li>Document your child's learning progress and achievements</li>
                <li>Create educational content for public viewing and sharing</li>
                <li>Share learning experiences with other students, parents, and educators</li>
                <li>Demonstrate effective learning methods and techniques</li>
                <li>Promote educational excellence and inspire other learners</li>
              </ul>
            </section>

            {/* How Content Will Be Used */}
            <section>
              <h3 className="text-lg font-bold text-blue-600 mb-3">
                HOW THE CONTENT WILL BE USED:
              </h3>
              <p className="mb-2">By providing consent, you authorize us to:</p>
              <ul className="list-disc list-inside space-y-1 ml-4 text-gray-700">
                <li>Publicly display the recorded content on our website and associated platforms</li>
                <li>Share the content on social media channels and educational platforms</li>
                <li>Distribute the content to educational institutions and organizations</li>
                <li>Use the content for promotional and educational purposes</li>
                <li>Retain the content for an indefinite period for archival and educational purposes</li>
              </ul>
              <p className="mt-2 text-gray-700">
                The content may be used for both commercial and non-commercial purposes, including but not limited to 
                educational materials, promotional content, and public demonstrations.
              </p>
            </section>

            {/* Privacy and Personal Information */}
            <section>
              <h3 className="text-lg font-bold text-green-600 mb-3">
                PRIVACY AND PERSONAL INFORMATION:
              </h3>
              <p className="mb-2">In compliance with the Children's Online Privacy Protection Act (COPPA) and other applicable privacy laws:</p>
              <ul className="list-disc list-inside space-y-1 ml-4 text-gray-700">
                <li>We will never collect, use, or disclose your child's personal information beyond what is necessary for the recording and sharing process</li>
                <li>Your child's full name, exact location, and other personally identifiable information will not be disclosed unless specifically authorized by you</li>
                <li>We implement reasonable security measures to protect all recorded content</li>
                <li>You have the right to review, request deletion, or withdraw consent for your child's recorded content at any time</li>
              </ul>
            </section>

            {/* Your Rights */}
            <section>
              <h3 className="text-lg font-bold text-green-600 mb-3">
                YOUR RIGHTS AS A PARENT/GUARDIAN:
              </h3>
              <div className="space-y-2 text-gray-700">
                <p><strong>Right to Withdraw Consent:</strong> You may withdraw your consent at any time by contacting us. Upon withdrawal, we will cease using the content and make reasonable efforts to remove it from public platforms, though we cannot guarantee complete removal from third-party sites where it may have been shared.</p>
                <p><strong>Right to Access:</strong> You may request access to all recordings featuring your child.</p>
                <p><strong>Right to Deletion:</strong> You may request the deletion of specific recordings or all recordings featuring your child.</p>
                <p><strong>Right to Opt-Out:</strong> You may choose not to provide consent, and your child will still have access to all learning activities without recording.</p>
              </div>
            </section>

            {/* Important Considerations */}
            <section>
              <h3 className="text-lg font-bold text-orange-600 mb-3">
                IMPORTANT CONSIDERATIONS:
              </h3>
              <ul className="list-disc list-inside space-y-1 ml-4 text-gray-700">
                <li><strong>No Exclusion from Learning:</strong> Refusing consent will NOT affect your child's ability to participate in learning activities.</li>
                <li><strong>Public Nature:</strong> Once content is shared publicly, it may be viewed, downloaded, and shared by others worldwide.</li>
                <li><strong>Permanent Record:</strong> Internet content can persist indefinitely even after deletion requests.</li>
                <li><strong>Third-Party Sharing:</strong> Content may be shared with educational partners and platforms for broader educational impact.</li>
              </ul>
            </section>

            {/* Contact Information */}
            <section>
              <h3 className="text-lg font-bold text-purple-600 mb-3">
                CONTACT INFORMATION:
              </h3>
              <p className="mb-2">If you have questions or concerns about this consent form or our privacy practices, please contact:</p>
              <div className="bg-gray-50 p-4 rounded-lg text-gray-700">
                <p><strong>Privacy Officer:</strong></p>
                <p>[Your Website Name]</p>
                <p>Email: privacy@yourwebsite.com</p>
                <p>Phone: [Your Phone Number]</p>
                <p>Address: [Your Business Address]</p>
              </div>
            </section>
          </div>
        </ScrollArea>

        {/* Consent Options */}
        <div className="p-6 pt-4 border-t flex-shrink-0">
          <h3 className="text-lg font-bold mb-4 text-center">CONSENT OPTIONS:</h3>
          
          <RadioGroup 
            value={consentChoice} 
            onValueChange={(value) => {
              console.log('Radio group value changed to:', value)
              setConsentChoice(value)
            }} 
            className="space-y-4"
          >
            <div className="flex items-start space-x-3 p-4 border-2 border-green-200 rounded-lg hover:border-green-400 transition-colors">
              <RadioGroupItem value="grant" id="grant" className="mt-1" />
              <Label htmlFor="grant" className="flex-1 cursor-pointer">
                <div className="flex items-center gap-2 mb-2">
                  <CheckCircle className="h-5 w-5 text-green-600" />
                  <span className="font-bold text-green-700">I GRANT CONSENT</span>
                </div>
                <p className="text-sm text-gray-600">
                  I am the parent/legal guardian of the child named below. I have read, understood, and agree to the terms 
                  outlined in this authorization form. I consent to the recording and public sharing of my child's learning 
                  activities as described above.
                </p>
              </Label>
            </div>

            <div className="flex items-start space-x-3 p-4 border-2 border-red-200 rounded-lg hover:border-red-400 transition-colors">
              <RadioGroupItem value="deny" id="deny" className="mt-1" />
              <Label htmlFor="deny" className="flex-1 cursor-pointer">
                <div className="flex items-center gap-2 mb-2">
                  <XCircle className="h-5 w-5 text-red-600" />
                  <span className="font-bold text-red-700">I DO NOT GRANT CONSENT</span>
                </div>
                <p className="text-sm text-gray-600">
                  I do not consent to the recording and sharing of my child's learning activities. I understand that my 
                  child will still be able to participate in all learning activities without being recorded.
                </p>
              </Label>
            </div>
          </RadioGroup>

          <div className="flex justify-center gap-4 mt-6">
            <Button 
              variant="outline" 
              onClick={handleClose}
              className="px-8"
            >
              Cancel
            </Button>
            <Button 
              onClick={handleSubmit}
              disabled={!consentChoice}
              className={`px-8 ${
                !consentChoice 
                  ? 'bg-gray-300 text-gray-500 cursor-not-allowed' 
                  : 'bg-blue-600 hover:bg-blue-700 text-white'
              }`}
            >
              {!consentChoice ? 'Please Select an Option Above' : 'Submit Decision'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}