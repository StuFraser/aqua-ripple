import { useState } from "react";
import { ApiError, apiClient } from "../api/client";
import Button from "../components/primitives/button";

type FeedbackCategory = "Ideas" | "General";

interface FeedbackResponse {
    success: boolean;
    discussionUrl: string;
}

const categories: { value: FeedbackCategory; label: string; description: string }[] = [
    { value: "Ideas", label: "Idea", description: "A feature or improvement you would like to see." },
    { value: "General", label: "Feedback", description: "A bug report, question, or general comment." },
];

const Feedback = () => {
    const [category, setCategory] = useState<FeedbackCategory>("General");
    const [message, setMessage] = useState("");
    const [website, setWebsite] = useState("");
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [discussionUrl, setDiscussionUrl] = useState<string | null>(null);

    const submit = async (event: React.FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        const trimmedMessage = message.trim();

        if (!trimmedMessage) {
            setError("Tell us what you think before submitting.");
            return;
        }

        setError(null);
        setIsSubmitting(true);
        try {
            const response = await apiClient.post<FeedbackResponse>("/api/feedback", {
                category,
                message: trimmedMessage,
                website,
            });
            setDiscussionUrl(response.discussionUrl || "submitted");
            setMessage("");
        } catch (submissionError) {
            setError(
                submissionError instanceof ApiError
                    ? submissionError.detail
                    : "Feedback could not be submitted. Please try again."
            );
        } finally {
            setIsSubmitting(false);
        }
    };

    if (discussionUrl) {
        return (
            <section className="max-w-2xl mx-auto py-10 text-center">
                <div className="text-4xl mb-4">🌊</div>
                <h1 className="text-2xl font-bold text-aqua-dark">Thank you for the feedback</h1>
                <p className="mt-3 text-gray-600">Your message has been submitted as a public GitHub Discussion.</p>
                {discussionUrl !== "submitted" && (
                    <a className="inline-block mt-5 font-semibold" href={discussionUrl} target="_blank" rel="noreferrer">
                        View the discussion ↗
                    </a>
                )}
            </section>
        );
    }

    return (
        <section className="max-w-2xl mx-auto py-8">
            <h1 className="text-2xl font-bold text-aqua-dark">Feedback</h1>
            <p className="mt-2 text-gray-600 leading-relaxed">
                Ideas, bug reports, and questions are welcome. Feedback is posted anonymously as a public GitHub Discussion, so please do not include personal information.
            </p>

            <form className="mt-7 space-y-6" onSubmit={submit}>
                <fieldset>
                    <legend className="text-sm font-semibold text-aqua-dark">What is this about?</legend>
                    <div className="mt-3 grid gap-3 sm:grid-cols-2">
                        {categories.map((option) => (
                            <button
                                key={option.value}
                                type="button"
                                onClick={() => setCategory(option.value)}
                                className={`rounded-lg border-2 p-4 text-left transition-colors ${
                                    category === option.value
                                        ? "border-aqua-brand bg-sky-50"
                                        : "border-gray-200 bg-white hover:border-aqua-accent"
                                }`}
                            >
                                <span className="block font-semibold text-aqua-dark">{option.label}</span>
                                <span className="mt-1 block text-xs text-gray-600">{option.description}</span>
                            </button>
                        ))}
                    </div>
                </fieldset>

                <label className="block">
                    <span className="text-sm font-semibold text-aqua-dark">Your message</span>
                    <textarea
                        className="mt-2 w-full min-h-36 rounded-lg border border-gray-300 p-3 text-sm text-gray-800 outline-none focus:border-aqua-brand focus:ring-2 focus:ring-sky-100"
                        value={message}
                        onChange={(event) => setMessage(event.target.value)}
                        maxLength={4000}
                        placeholder="What would make AquaRipple more useful?"
                        required
                    />
                    <span className="mt-1 block text-right text-xs text-gray-400">{message.length}/4000</span>
                </label>

                <input
                    className="hidden"
                    tabIndex={-1}
                    autoComplete="off"
                    aria-hidden="true"
                    name="website"
                    value={website}
                    onChange={(event) => setWebsite(event.target.value)}
                />

                {error && <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}

                <Button type="submit" isLoading={isSubmitting}>Submit feedback</Button>
            </form>
        </section>
    );
};

export default Feedback;
