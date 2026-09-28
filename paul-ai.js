/* JobSeek Paul AI Assistant
   CV Recruiter Helper
*/

window.PaulAI = {

    open() {

        const box = document.getElementById("paulAiBox");

        if(box){
            box.style.display = "block";
        }

    },


    analyze(cvText, jobDescription){

        if(!cvText || !jobDescription){

            return `
            Please add your CV and the job description first.
            I need both documents to give you a professional review.
            `;

        }


        const cv =
        cvText.toLowerCase();


        const job =
        jobDescription.toLowerCase();


        const words =
        job.match(/[a-zA-Z]{4,}/g) || [];


        let matched = 0;
        let missing = [];


        words.forEach(word=>{

            if(cv.includes(word)){

                matched++;

            }
            else if(!missing.includes(word)){

                missing.push(word);

            }

        });


        const score =
        Math.min(
            100,
            Math.round((matched / words.length) * 100)
        );


        return `

        <div class="paul-response">

        <h3>Hello, I am Paul 👋</h3>

        <p>
        I reviewed your CV against this job description.
        Here is what I found:
        </p>


        <h4>CV Match Score</h4>

        <strong>${score}%</strong>


        <h4>What matches</h4>

        <p>
        Your CV contains some of the requirements
        from this vacancy.
        </p>


        <h4>Areas to improve</h4>

        <ul>

        ${
        missing.slice(0,10)
        .map(item=>`<li>${item}</li>`)
        .join("")
        }

        </ul>


        <p>
        My advice: only add skills and experience that
        are true for you. Improve the evidence in your CV
        so employers can clearly see your value.
        </p>


        </div>

        `;


    }


};
