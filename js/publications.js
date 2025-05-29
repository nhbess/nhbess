// Function to fetch and display publications
async function loadPublications() {
    const spinner = document.getElementById('publications-spinner');
    if (spinner) spinner.style.display = '';
    try {
        // Using Semantic Scholar API to fetch publications
        const response = await fetch('https://api.semanticscholar.org/graph/v1/author/2299559532/papers?fields=title,authors,venue,year,abstract,url,citationCount,publicationVenue,publicationDate,fieldsOfStudy,openAccessPdf');
        const data = await response.json();
        const publications = data.data || [];
        
        // Sort publications by year (newest first)
        publications.sort((a, b) => (b.year || 0) - (a.year || 0));
        
        const container = document.getElementById('publications-container');
        container.innerHTML = ''; // Clear existing content
        
        publications.forEach(pub => {
            const article = document.createElement('article');
            article.className = 'publication-item';
            
            // Format authors
            const authors = pub.authors?.map(author => author.name).join(', ') || 'Unknown';
            
            // Format fields of study
            const fields = pub.fieldsOfStudy?.join(', ') || '';
            
            // Get PDF URL if available
            const pdfUrl = pub.openAccessPdf?.url || '';
            
            article.innerHTML = `
                <div class="publication-content">
                    <div class="publication-header">
                        <div class="publication-meta">
                            <span class="publication-year">${pub.year || 'N/A'}</span>
                            ${pub.citationCount > 0 ? `<span class="publication-citations"><i class="fas fa-quote-right"></i> ${pub.citationCount}</span>` : ''}
                        </div>
                        <h3 class="publication-title">
                            ${pub.url ? `<a href="${pub.url}" class="publication-title-link" target="_blank"><i class=\"fas fa-external-link-alt\"></i></a> ` : ''}
                            ${pub.title || 'Untitled'}
                        </h3>
                    </div>
                    <p class="publication-authors"><i class=\"fas fa-users\"></i> ${authors}</p>
                    <div class="publication-details">
                        ${pub.venue ? `<p class="publication-venue"><i class="fas fa-book"></i> ${pub.venue}</p>` : ''}
                        ${pub.abstract ? `
                            <div class="publication-abstract-container">
                                <button class="abstract-toggle">Show Abstract</button>
                                <div class="publication-abstract" style="display: none;">
                                    <p>${pub.abstract}</p>
                                </div>
                            </div>
                        ` : ''}
                    </div>
                    <div class="publication-links">
                        ${pdfUrl ? `<a href="${pdfUrl}" class="publication-link pdf-link" target="_blank"><i class="fas fa-file-pdf"></i></a>` : ''}
                    </div>
                </div>
            `;
            
            // Add event listener for abstract toggle
            const abstractToggle = article.querySelector('.abstract-toggle');
            if (abstractToggle) {
                abstractToggle.addEventListener('click', () => {
                    const abstract = article.querySelector('.publication-abstract');
                    const isHidden = abstract.style.display === 'none';
                    abstract.style.display = isHidden ? 'block' : 'none';
                    abstractToggle.textContent = isHidden ? 'Hide Abstract' : 'Show Abstract';
                });
            }
            
            container.appendChild(article);
        });
    } catch (error) {
        console.error('Error loading publications:', error);
        document.getElementById('publications-container').innerHTML = 
            '<p class="error-message">Failed to load publications. Please try again later or check my <a href="https://scholar.google.com/citations?user=xnRLzlUAAAAJ&hl=en" target="_blank">Google Scholar profile</a>.</p>';
    } finally {
        if (spinner) spinner.style.display = 'none';
    }
}

// Load publications when the page loads
document.addEventListener('DOMContentLoaded', loadPublications); 