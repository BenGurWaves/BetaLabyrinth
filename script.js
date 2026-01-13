parseInt(dot.getAttribute('data-step')) === stepNumber);
            }); 
           
            // Show correct step content
            document.getElementById('usernameStep').classList.toggle('active', stepNumber === 1);
            document.getElementById('birthdayStep').classList.toggle('active', stepNumber === 2);
           
            // Reset step if going back to username
            if (stepNumber === 1) {
                document.getElementById('usernameInput').value = '';
                document.getElementById('usernameBtn').disabled = true;
            }
        }
       
        // Clear all error messages
        function clearErrors() {
            document.querySelectorAll('.error-message').forEach(error => {
                error.classList.remove('show');
            });
        }
    </script>
</body>
</html>
