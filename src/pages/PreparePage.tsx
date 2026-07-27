import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useInterviewStore } from '../store/interviewStore';
import { generateQuestionsFromDetails } from '../services/awsApi';

export const PREPARE_FIELDS: { key: string; label: string; placeholder: string; required?: boolean }[] = [
  { key: 'visaType',       label: 'Visa type you are applying for',        placeholder: 'e.g. UK Student Visa (Tier 4)', required: true },
  { key: 'course',         label: 'Course / programme',                    placeholder: 'e.g. MSc Computer Science', required: true },
  { key: 'university',     label: 'University / institution',              placeholder: 'e.g. University of Manchester', required: true },
  { key: 'courseStart',    label: 'Course start date',                     placeholder: 'e.g. September 2025' },
  { key: 'courseDuration', label: 'Course duration',                       placeholder: 'e.g. 1 year, 3 years' },
  { key: 'funding',        label: 'How you are funding your studies / stay', placeholder: 'e.g. £30,000 personal savings at Barclays', required: true },
  { key: 'sponsor',        label: 'Sponsor name & relationship (if any)',  placeholder: 'e.g. Father – Mr. Raj Sharma, earns £45,000/year' },
  { key: 'english',        label: 'English test & score',                  placeholder: 'e.g. IELTS 7.0 (Jan 2025)' },
  { key: 'hometies',       label: 'Ties to your home country',             placeholder: 'e.g. Parents, family home, job offer waiting' },
  { key: 'futurePlans',    label: 'Plans after your visa / studies end',   placeholder: 'e.g. Return to Nepal, work as software engineer at XYZ', required: true },
  { key: 'prevVisas',      label: 'Previous UK / other country visas',     placeholder: 'e.g. UK visitor visa 2022, no refusals' },
  { key: 'extraInfo',      label: 'Any other relevant details',            placeholder: 'e.g. scholarship, employer name, accommodation arranged' },
];

type Stage = 'form' | 'generating' | 'ready';

export function PreparePage() {
  const navigate = useNavigate();
  const { setCustomQuestions, setSelectedType, userDetailsByType, setUserDetails, customQuestions } = useInterviewStore();

  const saved = (userDetailsByType['visa'] ?? {}) as Record<string, string>;
  const hasSaved = PREPARE_FIELDS.filter(f => f.required).every(f => saved[f.key]?.trim());

  const [values, setValues] = useState<Record<string, string>>(saved);
  const [stage, setStage] = useState<Stage>(() => {
    // Already have questions + details saved → skip straight to ready
    if (customQuestions.length > 0 && hasSaved) return 'ready';
    // Details saved but no questions → auto-generate (will trigger in useEffect)
    if (hasSaved) return 'generating';
    return 'form';
  });
  const [error, setError] = useState('');

  const generate = async (detailValues: Record<string, string>) => {
    setError('');
    setStage('generating');
    try {
      const questions = await generateQuestionsFromDetails(detailValues);
      setCustomQuestions(questions);
      setSelectedType('document-custom');
      setStage('ready');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not generate questions. Please try again.');
      setStage('form');
    }
  };

  // Auto-generate when details are already saved and we have no questions
  useEffect(() => {
    if (stage === 'generating' && hasSaved && customQuestions.length === 0) {
      generate(saved);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleFormSubmit = () => {
    setUserDetails('visa', values);
    generate(values);
  };

  const requiredFilled = PREPARE_FIELDS.filter(f => f.required).every(f => values[f.key]?.trim());
  const setValue = (key: string, val: string) => setValues(prev => ({ ...prev, [key]: val }));

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-slate-100 flex flex-col">
      <header className="bg-white/80 backdrop-blur-sm border-b border-gray-200 sticky top-0 z-20">
        <div className="max-w-2xl mx-auto px-5 h-16 flex items-center justify-between">
          <button onClick={() => navigate('/')} className="flex items-center gap-2.5 hover:opacity-80 transition-opacity">
            <div className="w-9 h-9 bg-blue-700 rounded-xl flex items-center justify-center text-lg shadow-sm">🛂</div>
            <div>
              <p className="font-extrabold text-gray-900 leading-none text-sm">PassMyVisa</p>
              <p className="text-[11px] text-gray-400 leading-none mt-0.5">AI Interview Practice</p>
            </div>
          </button>
          <button onClick={() => navigate('/')} className="text-sm text-gray-500 hover:text-gray-700 transition-colors">← Back</button>
        </div>
      </header>

      <main className="flex-1 max-w-2xl mx-auto w-full px-5 py-10">

        {/* Generating */}
        {stage === 'generating' && (
          <div className="bg-white rounded-2xl border border-blue-100 shadow-sm p-12 text-center">
            <div className="w-14 h-14 rounded-full border-4 border-blue-600 border-t-transparent animate-spin mx-auto mb-5" />
            <h2 className="text-xl font-bold text-gray-900 mb-2">Building your questions…</h2>
            <p className="text-gray-400 text-sm">AI is preparing 15–20 personalised questions based on your details.</p>
          </div>
        )}

        {/* Ready */}
        {stage === 'ready' && (
          <div className="bg-white rounded-2xl border border-green-200 shadow-sm p-8 text-center">
            <div className="text-5xl mb-4">✅</div>
            <h2 className="text-2xl font-extrabold text-gray-900 mb-2">Questions Ready!</h2>
            <p className="text-gray-500 mb-1 max-w-sm mx-auto">
              {customQuestions.length} personalised interview questions are ready.
            </p>
            <p className="text-xs text-gray-400 mb-8">
              To change your details, go to <button onClick={() => navigate('/profile')} className="text-blue-500 underline">Profile → My Details</button>.
            </p>
            <button
              onClick={() => navigate('/interview')}
              className="px-10 py-4 bg-blue-700 hover:bg-blue-600 active:scale-[0.98] text-white font-bold text-lg rounded-xl transition-all shadow-lg hover:shadow-blue-200 inline-flex items-center gap-3"
            >
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M15.75 10.5l4.72-4.72a.75.75 0 011.28.53v11.38a.75.75 0 01-1.28.53l-4.72-4.72M4.5 18.75h9a2.25 2.25 0 002.25-2.25v-9a2.25 2.25 0 00-2.25-2.25h-9A2.25 2.25 0 002.25 7.5v9a2.25 2.25 0 002.25 2.25z" />
              </svg>
              Start My Interview
            </button>
          </div>
        )}

        {/* Form — shown only first time */}
        {stage === 'form' && (
          <div className="flex flex-col gap-6">
            <div className="text-center">
              <h1 className="text-3xl font-extrabold text-gray-900 mb-2">Your Details</h1>
              <p className="text-gray-500 text-sm max-w-md mx-auto">
                Fill this in once — AI will generate 15–20 questions tailored to your application.
                You can edit these details anytime from your Profile.
              </p>
            </div>

            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
              <div className="px-5 py-3 bg-blue-50 border-b border-blue-100">
                <p className="text-xs font-bold text-blue-700 uppercase tracking-wider">Fields marked * are required</p>
              </div>
              <div className="p-5 flex flex-col gap-4">
                {PREPARE_FIELDS.map(f => (
                  <div key={f.key} className="flex flex-col gap-1.5">
                    <label className="text-sm font-semibold text-gray-700">
                      {f.label}{f.required && <span className="text-blue-600 ml-0.5">*</span>}
                    </label>
                    <input
                      type="text"
                      value={values[f.key] ?? ''}
                      onChange={e => setValue(f.key, e.target.value)}
                      placeholder={f.placeholder}
                      className="px-4 py-2.5 rounded-xl border border-gray-200 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-200 transition-colors"
                    />
                  </div>
                ))}
              </div>
            </div>

            {error && (
              <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-700">⚠️ {error}</div>
            )}

            <button
              onClick={handleFormSubmit}
              disabled={!requiredFilled}
              className={[
                'w-full py-4 rounded-xl font-bold text-base transition-all flex items-center justify-center gap-2',
                requiredFilled
                  ? 'bg-blue-700 hover:bg-blue-600 active:scale-[0.98] text-white shadow-lg hover:shadow-blue-200'
                  : 'bg-gray-100 text-gray-400 cursor-not-allowed',
              ].join(' ')}
            >
              {requiredFilled ? 'Generate My Interview Questions' : 'Fill in required fields to continue'}
            </button>
            <p className="text-center text-xs text-gray-400">Saved privately. Edit anytime from your Profile.</p>
          </div>
        )}
      </main>
    </div>
  );
}
